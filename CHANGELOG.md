# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento conforme [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-07-31

Primeira versão pública. Reconstrução completa a partir do CRUD inicial,
seguida de duas ondas de evolução do produto.

### Adicionado

- Arquitetura Hexagonal (Ports & Adapters) com cinco camadas e fronteira
  verificável por `grep`.
- Domínio rico: 4 entidades com invariantes, 10 Value Objects imutáveis,
  `Result` pattern no lugar de exceções para regra de negócio.
- Autenticação com bcrypt, regeneração de sessão, política de senha e
  confirmação de senha no cadastro.
- Autorização por dono em todos os recursos, garantida no agregado e reforçada
  no filtro da consulta.
- Etiquetas com seletor de chips e sugestões unificadas; favoritos com um
  clique (POST + CSRF, auditado).
- Busca por nome, e-mail ou telefone (escape anti-ReDoS) e filtros por etiqueta
  e favoritos, preservados na paginação.
- Compromissos com calendário mensal renderizado no servidor (fuso
  America/Sao_Paulo) e vínculo opcional a contato com verificação de posse.
- Painel "Visão geral" com totais, distribuição por etiqueta e próximos
  compromissos — gráficos em SVG/CSS, sem biblioteca externa.
- Exportação em CSV (BOM UTF-8, separador `;`, neutralização de CSV injection)
  e JSON, com registro na trilha de auditoria.
- Trilha de auditoria append-only, consultável pelo usuário, com retenção via
  índice TTL.
- Tema claro/escuro com alternância persistida e respeito à preferência do
  sistema.
- Cancelamento cooperativo ponta a ponta (`AbortSignal`) e contexto de execução
  (`AsyncLocalStorage`).
- Observabilidade: logs estruturados com `requestId`, health/readiness checks.
- Seed idempotente e migrations versionadas.
- 172 testes automatizados (99 unitários, 73 de integração).
- Docker multi-stage não-root, Terraform modular (AWS ECS Fargate) como
  referência, pipelines GitHub Actions e deploy contínuo no Fly.io com domínio
  próprio (https://agenda.eduardovalente.dev).

### Segurança

- CSRF próprio com comparação em tempo constante.
- Proteção contra enumeração de contas (mensagem e latência uniformes).
- Rate limiting global e específico de autenticação.
- Content Security Policy explícita (incluindo `script-src-attr 'none'`);
  sanitização contra NoSQL injection.
- Redação automática de dados sensíveis na trilha de auditoria.
- Segredos recusados por denylist de hashes SHA-256, validados no boot.

### Corrigido (em relação ao projeto original)

- Vazamento total de dados: contatos não tinham dono; a agenda era
  compartilhada entre todos os usuários.
- Segredo de sessão fixo no código-fonte.
- Exclusão de recursos via GET (fora do alcance do CSRF e alcançável por
  prefetch do navegador).
- Rotas assíncronas sem tratamento derrubavam o processo.
- Hash de senha propagado para a sessão e para as views.
