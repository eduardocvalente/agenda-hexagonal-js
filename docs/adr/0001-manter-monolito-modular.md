# ADR-0001 — Manter monólito modular

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

A aplicação tem 4 entidades, ~350 linhas de lógica de domínio e um mantenedor.
A auditoria avaliou migrar para Clean Architecture com camadas explícitas
(`domain`, `application`, `infrastructure`), inversão de dependência e
interfaces de repositório — e, em outro extremo, fatiar em microsserviços.

## Decisão

Manter monólito modular com organização por tipo (`controllers`, `models`,
`middleware`, `routes`, `config`), corrigindo o que efetivamente dói:
autorização, tratamento de erro, configuração e observabilidade.

## Consequências

**Positivas:** custo cognitivo baixo; deploy único; transações locais;
depuração direta; um `npm test` cobre o sistema inteiro.

**Negativas:** os models acumulam validação e acesso a dados; trocar o MongoDB
exigiria alterá-los; não há fronteira formal que impeça um controller de fazer
query direta — a disciplina é convenção, não compilador.

**Aceitas conscientemente.** O acoplamento existe, mas ainda não custou nada.

## Alternativas recusadas

**Clean Architecture completa** — triplicaria a contagem de arquivos e
introduziria interfaces com uma implementação cada, para eliminar um
acoplamento que ainda não dói. Abstração antecipada é dívida com juros
invertidos: paga-se antes de saber se o problema aparece.

**Microsserviços** — transformaria chamadas de função em chamadas de rede, com
todos os modos de falha associados (timeout, retry, consistência eventual,
tracing distribuído obrigatório) em troca de nenhum ganho para um único
mantenedor.

## Quando revisitar

- Ao surgir um segundo consumidor da lógica de domínio (app móvel, API pública);
- se os models passarem de ~300 linhas cada;
- se o time crescer a ponto de duas pessoas mexerem no mesmo arquivo com frequência.
