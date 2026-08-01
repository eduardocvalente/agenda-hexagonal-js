# ADR-0007 — Result Pattern para falhas esperadas

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

A versão anterior acumulava erros em um array (`this.errors.push(...)`) dentro do
model e o chamador inspecionava `errors.length > 0`. Três problemas concretos:
a assinatura não revelava que a operação podia falhar; o objeto ficava em estado
inválido mas utilizável; e o motivo da falha era uma **string**, então qualquer
tratamento diferenciado dependia de comparar mensagens.

## Decisão

`Result<T>` com as variantes `Success` e `Failure`, ambas imutáveis. Todo caso de
uso devolve `Result`.

**A regra de quando usar cada mecanismo:**

| Situação                           | Mecanismo                        |
| ---------------------------------- | -------------------------------- |
| Validação de entrada               | `Result.fail(ValidationError)`   |
| Regra de negócio violada           | `Result.fail(BusinessRuleError)` |
| Recurso não encontrado             | `Result.fail(NotFoundError)`     |
| Cancelamento                       | `Result.fail(CancelledError)`    |
| Banco fora, bug, estado impossível | **exceção**                      |

A linha divisória: falha **prevista** é valor de retorno; falha **imprevista** é
exceção. Exceção como controle de fluxo de regra de negócio torna o caminho de
erro invisível na assinatura, é cara no runtime e induz `try/catch` genérico que
engole bug junto com validação.

## Alternativas consideradas

**Either de bibliotecas funcionais (fp-ts, neverthrow).** Mais completo e
testado. Recusado: traz um vocabulário funcional inteiro (`chain`, `fold`, `Task`)
que aumenta a barreira de entrada muito além do que o projeto usa. A
implementação própria tem ~100 linhas e expõe seis métodos.

**Convenção `[erro, valor]` (estilo Go).** Simples, mas não compõe: encadear
três operações vira três `if (erro) return`. O `flatMap` do Result curto-circuita
sozinho.

**Exceções para tudo.** É o padrão do ecossistema JavaScript. Recusado pelos
motivos acima — e porque o `UseCase` base já converte exceção inesperada em
`Result.fail`, de modo que os dois mundos convivem sem que o chamador precise
saber qual aconteceu.

## Consequências

**Positivas:** o compilador mental do leitor vê que a operação pode falhar;
`match` obriga a tratar os dois caminhos; `collectAll` acumula erros e permite
mostrar todos os problemas do formulário de uma vez, em vez de um por submissão.

**Negativas:** verbosidade — `if (r.isFailure) return r;` aparece com frequência
nos casos de uso. Sem tipos estáticos, nada impede alguém de acessar `.value` de
uma falha; a mitigação é lançar `TypeError` nesse caso, transformando o descuido
em erro imediato e barulhento em vez de `undefined` silencioso.
