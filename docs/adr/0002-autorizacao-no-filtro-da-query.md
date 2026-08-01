# ADR-0002 — Autorização no filtro da query

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

O achado mais grave da auditoria (ACH-001) foi a ausência de proprietário na
coleção de contatos: qualquer usuário autenticado lia, editava e apagava os
contatos de todos, e a home expunha a base inteira para visitantes anônimos.

Três formas de corrigir foram avaliadas:

1. middleware de autorização que carrega o recurso e compara o dono;
2. plugin global do Mongoose que injeta o filtro automaticamente;
3. filtro por dono embutido em cada consulta, no model.

## Decisão

Opção 3. Toda consulta a `contatos` inclui `user: <id da sessão>` no filtro. O
identificador vem **exclusivamente** de `req.session.user.id`, nunca do corpo,
da query string ou de cabeçalho.

```js
static async buscaPorId(id, userId) {
  if (!Contato.isValidId(id)) return null;
  return ContatoModel.findOne({ _id: id, user: userId }).lean();
}
```

## Justificativa

**Contra a opção 1:** um middleware é opt-in. Basta esquecê-lo em uma rota nova
para reabrir o buraco — e é exatamente o tipo de esquecimento que passa em
revisão de código, porque a ausência de uma linha não chama atenção.

**Contra a opção 2:** um plugin global torna o comportamento invisível. Quando
uma query retorna vazio inesperadamente, o desenvolvedor não vê o filtro em
lugar nenhum e perde tempo até descobrir que existe.

**A favor da opção 3:** o filtro **é** a autorização. Não há caminho de código
que consulte contatos sem passar por ele, porque ele está dentro do único lugar
que sabe consultar contatos. Uma tentativa de acessar dado alheio simplesmente
não casa nenhum documento.

## Consequências

**Positivas:** impossível esquecer; visível na leitura; mesmo 404 para "não
existe" e "não é seu", o que impede enumerar ids de terceiros; o índice composto
`{user:1, criadoEm:-1}` serve simultaneamente à autorização e ao desempenho.

**Negativas:** cada método precisa receber `userId`, o que polui um pouco a
assinatura; um futuro papel de administrador exigirá um caminho separado e
explícito — o que, aliás, é desejável.

## Verificação

`tests/integration/contato-authorization.test.js` — 10 testes cobrindo leitura,
edição, exclusão, listagem, mass assignment do campo `user` e acesso anônimo.
Nenhuma alteração pode ser mesclada com esses testes falhando.
