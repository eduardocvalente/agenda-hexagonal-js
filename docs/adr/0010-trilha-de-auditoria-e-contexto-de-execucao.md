# ADR-0010 — Trilha de auditoria e contexto de execução

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

Não havia registro de quem fez o quê. Os logs mostram requisições, mas log e
trilha de auditoria são coisas diferentes: log é operacional, volátil e
orientado a diagnóstico; trilha é registro de negócio, consultável pelo próprio
usuário e com prazo de retenção definido.

Sem trilha, três perguntas ficam sem resposta: "quem apagou este contato?",
"alguém entrou na minha conta?" e "o que aconteceu nesta conta antes do
problema?".

## Decisões

### 1. Contexto por `AsyncLocalStorage`, não por parâmetro

`requestId`, `usuarioId`, IP e user agent são metadados transversais. Passá-los
como parâmetro por toda a cadeia — controller → caso de uso → serviço →
repositório — poluiria assinaturas com dados que o domínio não usa.

**A regra de uso é restritiva e não é negociável:** o contexto carrega
**metadado**, nunca **dado de negócio**. Por isso `CriarContato` continua
recebendo `proprietarioId` como parâmetro explícito, mesmo existindo no
contexto — ali é dado de negócio. Um caso de uso que lesse o dono do contexto
ficaria impossível de testar sem montar o ambiente, e a dependência sumiria da
assinatura, virando um parâmetro invisível.

**Custos:** overhead pequeno mas real em cada salto assíncrono; e o contexto se
perde se alguma biblioteca quebrar a cadeia async. Por isso todo consumidor
trata ausência como caso normal, não como erro.

### 2. Falha de auditoria não derruba a operação

`ServicoDeAuditoria.registrar` nunca lança e nunca devolve erro. Se a gravação
falhar, registra `error` no log e a operação de negócio segue.

|             |                                                                              |
| ----------- | ---------------------------------------------------------------------------- |
| **A favor** | Problema na collection de auditoria não impede o usuário de criar um contato |
| **Contra**  | Em caso de falha, existe ação sem registro correspondente                    |

**Isto é insuficiente para auditoria de conformidade**, em que a ausência de
registro deve invalidar a operação. Nesse cenário seria preciso gravar na mesma
transação ou usar o padrão Outbox. Este sistema não tem esse requisito; quando
tiver, esta decisão é o ponto de partida da revisão.

### 3. Append-only imposto pela forma da porta

`AuditoriaRepository` não tem `atualizar` nem `remover`. A ausência é o
contrato: um adaptador não consegue oferecer edição sem inventar um método fora
da interface, e isso aparece em revisão de código. Trilha editável não serve
como registro de nada.

A expiração existe, mas é política de retenção aplicada pelo banco (índice TTL),
não uma operação que a aplicação possa invocar.

### 4. Tentativa de login com e-mail inexistente **não** é registrada

Esta é a decisão mais contraintuitiva do conjunto, e a mais importante.

| Situação                            | Registra? | Por quê                                                |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| Senha errada em conta **existente** | **Sim**   | O dono precisa ver "alguém tentou entrar na sua conta" |
| E-mail **inexistente**              | **Não**   | Ver abaixo                                             |

Registrar a segunda exigiria guardar o e-mail tentado — e isso construiria
progressivamente uma base de "endereços que alguém tentou usar". Esse artefato
é sensível, foi criado pela própria defesa, não tem dono a quem pertencer
(viola a invariante da entidade) e não pode ser mostrado a ninguém sem revelar
quais contas existem.

O evento continua visível no log operacional, com nível `warn`, para detecção
de ataque em andamento. A diferença: log tem retenção curta e acesso restrito à
operação; trilha é dado pessoal consultável pelo titular.

### 5. Sanitização recursiva dos detalhes

`detalhes` passa por uma lista de chaves proibidas (`password`, `senha`,
`token`, `_csrf`, `authorization`, …), recursivamente até 3 níveis. Chave
proibida vira `[REDACTED]`.

**Redige em vez de recusar**: perder o evento inteiro por causa de um campo é
pior que registrá-lo parcialmente.

A profundidade de 3 níveis é um limite pragmático — objetos mais profundos que
isso não deveriam estar em um registro de auditoria de qualquer forma.

### 6. Retenção obrigatória via índice TTL

Padrão de 180 dias, configurável por `AUDITORIA_RETENCAO_DIAS`. Duas razões
independentes, e cada uma bastaria:

- **LGPD:** guardar dado pessoal além da finalidade é irregular;
- **custo:** é a collection que mais cresce, e sem teto vira o maior item de
  armazenamento do sistema.

### 7. Escopo do usuário, sem painel administrativo

`listarDoUsuario` exige `usuarioId` na assinatura — não existe consulta sem
escopo de dono. Um painel com visão de toda a trilha exigiria um caso de uso
separado com verificação de papel explícita. Não existe hoje, e é melhor que
não exista do que exista mal feito.

## Consequências

**Positivas:** o usuário vê e reconhece atividade na própria conta;
investigação de incidente ganha o `requestId` que correlaciona trilha e log;
detalhes de "de → para" na edição respondem _o que mudou_, não só _o que ficou_;
segredo não entra na trilha nem por descuido.

**Negativas:** uma collection a mais crescendo; overhead do `AsyncLocalStorage`
em toda requisição; o risco real de a trilha ser tratada como prova
irrefutável quando, pela decisão 2, ela é _best-effort_.

## Verificação

- `tests/unit/domain/RegistroDeAuditoria.test.js` — 15 testes (invariantes, sanitização recursiva, append-only)
- `tests/unit/shared/ContextoDeExecucao.test.js` — 7 testes, incluindo isolamento entre escopos concorrentes
- `tests/integration/auditoria.test.js` — 12 testes, incluindo "senha em texto puro nunca chega à trilha" e "e-mail inexistente não cria registro algum"
