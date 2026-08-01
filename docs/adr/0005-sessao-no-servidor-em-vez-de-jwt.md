# ADR-0005 — Sessão no servidor em vez de JWT

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

A aplicação já usava `express-session` com store no MongoDB. A auditoria avaliou
migrar para JWT stateless, escolha frequente em projetos de portfólio.

## Decisão

Manter sessão no servidor, com o store corrigido para reutilizar o cliente do
Mongoose (ver ACH-018) e a sessão cifrada em repouso.

## Justificativa

**Revogação imediata.** A operação mais importante em resposta a um incidente é
"invalide todas as sessões agora". Com sessão no servidor, isso é uma escrita.
Com JWT, é impossível sem manter uma lista de revogação — que é um store de
sessão com outro nome, e com a desvantagem de precisar ser consultada a cada
requisição de qualquer forma.

**Sem token no cliente.** Não existe a pergunta "onde guardar o JWT?", cuja
resposta comum (`localStorage`) o torna legível por qualquer XSS. O cookie é
`httpOnly` e o JavaScript da página não o alcança.

**A aplicação é server-side rendered.** JWT resolve o problema de escalar
autenticação sem estado compartilhado entre serviços. Não há múltiplos serviços.

**O custo alegado não se aplica.** O argumento a favor do JWT é evitar a
consulta ao store a cada requisição. Aqui, cada requisição já consulta o banco
para renderizar a página — a leitura da sessão é marginal e usa o mesmo pool.

## Consequências

**Positivas:** revogação instantânea; rotação de segredo invalida tudo de uma
vez; sem token exposto ao cliente; `regenerate()` no login resolve session
fixation de forma trivial.

**Negativas:** toda requisição autenticada faz uma leitura na coleção
`sessions` — em volume alto, é a query mais frequente do sistema e o primeiro
candidato a virar gargalo. Sessão passa a ser estado compartilhado que precisa
estar disponível.

## Mitigação prevista

Se a leitura de sessão virar gargalo (medir antes — ver seção 19 da auditoria),
migrar o store para Redis (ElastiCache). Custo estimado ~US$ 15/mês, sem mudança
na aplicação além da troca do store: o padrão `connect-*` mantém a interface.

Isso é preferível ao JWT porque preserva a revogação imediata.
