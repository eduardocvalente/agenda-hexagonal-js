# ADR-0003 — CSRF próprio no lugar do `csurf`

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

O projeto usava `csurf@1.11.0`, **descontinuado pelo time do Express em setembro
de 2022** e sem manutenção desde então. Dependência sem manutenção no caminho de
segurança é dívida com prazo indeterminado: quando surgir uma vulnerabilidade,
não haverá correção.

## Decisão

Implementar o _Synchronizer Token Pattern_ sobre a sessão, em
`src/middleware/csrf.js` — cerca de 40 linhas.

```js
const token = issueToken(req.session); // 32 bytes aleatórios
if (SAFE_METHODS.has(req.method)) return next();
const sent = req.body?._csrf || req.get('x-csrf-token');
if (!sent || !safeEqual(sent, token)) {
  return next(forbidden('Token CSRF inválido ou ausente.'));
}
```

Com comparação em tempo constante (`crypto.timingSafeEqual`) e rotação do token
em toda elevação de privilégio (login).

## Alternativas

**`csrf-csrf`** (mantido, padrão double-submit) — a opção mais defensável se o
critério fosse "não escrever código de segurança". Recusada porque o padrão
síncrono é simples o bastante para ser revisado por inteiro em uma leitura, e
porque a aplicação já tem sessão no servidor — o double-submit existe justamente
para casos em que não há.

**Reescrever para stateless com JWT** — mudança de arquitetura desproporcional a
um problema de biblioteca.

## Consequências

**Positivas:** uma dependência a menos; código auditável por inteiro; rotação
integrada ao ciclo de sessão; nenhum comportamento herdado desnecessário.

**Negativas:** código de segurança próprio precisa ser mantido e revisado por
alguém. O risco é real e é mitigado por testes explícitos (POST sem token → 403,
token de outra sessão → 403) e pelo tamanho reduzido da superfície.

## Condição de reversão

Se surgir uma biblioteca de CSRF mantida e amplamente adotada no ecossistema
Express, migrar. O contrato do middleware (`csrfProtection`, `rotateToken`) foi
desenhado para tornar a troca local.
