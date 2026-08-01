# ADR-0008 — Cancelamento cooperativo com AbortSignal

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

Nenhuma operação era cancelável. Um usuário que fechasse a aba durante uma
listagem deixava a query rodando no MongoDB e o processamento seguindo até o
fim — trabalho cujo resultado ninguém receberia. Sob carga, é desperdício
proporcional à taxa de abandono.

## Decisão

`AbortController` por requisição, com o `AbortSignal` propagado por toda a
cadeia: middleware → controller → caso de uso → repositório → driver.

```
res.on('close') ──┐
                  ├── AbortSignal.any ──► req.signal ──► ... ──► maxTimeMS
AbortSignal.timeout(30s) ──┘
```

Dois mecanismos, porque um sozinho não basta:

- **`throwIfAborted(signal)`** — pontos de checagem entre etapas, para desistir
  antes de iniciar o próximo passo caro;
- **`runCancellable(promise, signal)`** — abandona a espera por um resultado que
  já não interessa.

E, no adaptador de persistência, **`maxTimeMS`**: sem ele o `runCancellable`
libera a requisição mas a query continua executando no servidor do banco — que
é exatamente o recurso que se queria poupar.

## O limite honesto

**Em Node não existe forma de interromper uma computação em andamento de fora.**
"Cooperativo" é literal: só é cancelável o que checa o sinal.

| Operação                      | Cancelável | Observação                     |
| ----------------------------- | ---------- | ------------------------------ |
| Trecho entre `throwIfAborted` | ✅         | Desiste antes do próximo passo |
| Espera por query do Mongo     | ✅         | `runCancellable`               |
| Execução no servidor do Mongo | ✅         | `maxTimeMS`                    |
| Timers e delays               | ✅         | Timer é limpo                  |
| **`bcrypt.hash` / `compare`** | ❌         | JS puro, roda até o fim        |

O bcrypt é a exceção importante, não uma nota de rodapé: é justamente a operação
que satura a event loop sob ataque. A requisição é liberada, mas a CPU continua
ocupada. Cancelar de verdade exigiria mover o hash para um worker thread e
derrubá-lo — trabalho registrado no roadmap, **não implementado**.

Afirmar que "toda operação aceita cancelamento" seria falso precisamente onde a
diferença mais importa.

## Consequências

**Positivas:** requisição abandonada para de consumir banco e CPU; timeout
absoluto impede requisição pendurada indefinidamente; cancelamento é
classificado como **HTTP 499**, fora da faixa 5xx — fechar a aba não consome
error budget nem dispara alarme de disponibilidade.

**Negativas:** `signal` como último parâmetro em toda porta polui as assinaturas;
esquecer de propagá-lo em um elo quebra a cadeia silenciosamente (mitigado por
6 testes de integração que verificam a propagação ponta a ponta); e há o risco
real de o cancelamento passar a ser vendido como completo quando não é — daí a
tabela acima estar em três documentos diferentes.

## Verificação

`tests/unit/shared/cancelamento.test.js` (14 testes) e
`tests/integration/cancelamento.test.js` (6 testes) provam que o sinal atravessa
controller → caso de uso → repositório → driver, e que uma escrita cancelada
não persiste nada.
