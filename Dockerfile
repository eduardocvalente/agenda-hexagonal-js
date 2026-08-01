# syntax=docker/dockerfile:1.7
#
# Build multi-stage. A imagem final não contém npm cache, devDependencies,
# testes, Terraform nem o histórico do git.
#
# Em produção, troque as tags por digests imutáveis:
#   FROM node:22.11.0-alpine@sha256:<digest> AS deps
# Tag sozinha é mutável e quebra a reprodutibilidade do build.

ARG NODE_VERSION=22.11.0

# ---------- deps: apenas dependências de produção ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` falha se o lock estiver dessincronizado — é o que garante build reproduzível.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# ---------- build/test: valida antes de empacotar ----------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
COPY . .
RUN npm run lint

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime

# tini como PID 1: encaminha SIGTERM ao Node (essencial para o graceful shutdown)
# e recolhe processos zumbis.
RUN apk add --no-cache tini=~0.19 && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# O usuário `node` (uid 1000) já vem na imagem oficial. Root não é usado em
# nenhum momento da execução.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts

USER node

EXPOSE 3000

# Liveness dentro do container. O orquestrador tem os probes dele; este cobre
# `docker run` e `docker compose` puros.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
