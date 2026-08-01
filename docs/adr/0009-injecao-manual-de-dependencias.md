# ADR-0009 — Injeção de dependências manual

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

A arquitetura hexagonal exige que casos de uso recebam portas em vez de importar
implementações. Alguém precisa decidir qual adaptador satisfaz cada porta e
montar o grafo.

## Decisão

Um `Container` próprio (~50 linhas) com registro explícito em
`infrastructure/container/composicao.js`. Sem framework de DI.

```js
container.registrarSingleton(
  'criarContato',
  (c) =>
    new CriarContato({
      contatoRepository: c.resolver('contatoRepository'),
      logger: c.resolver('logger'),
    })
);
```

## Alternativas

| Opção                                               | Por que não                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Awilix**                                          | Auto-resolução por nome de parâmetro. Renomear um argumento quebra o cabeamento em runtime, longe da causa |
| **InversifyJS / tsyringe**                          | Dependem de decorators e `reflect-metadata`; decorators ainda não são padrão em JS                         |
| **`require` direto no caso de uso**                 | Elimina a inversão de dependência e o teste sem banco — anula o objetivo da arquitetura                    |
| **Parâmetros no construtor, montados no server.js** | Funciona, mas espalha o cabeamento pelo bootstrap                                                          |

Um contêiner com auto-resolução paga por si quando o grafo é grande o bastante
para o cabeamento manual doer. Com 12 nós estáticos, ele troca um arquivo
explícito e depurável por resolução implícita em runtime. YAGNI aplicado à
própria infraestrutura.

## Consequências

**Positivas:** `composicao.js` mostra a arquitetura inteira em uma leitura de
cima para baixo; erro de cabeamento aparece no boot com o nome da dependência e
a lista das registradas; teste troca qualquer porta por dublê via `overrides`;
zero dependências novas.

**Negativas:** cada caso de uso novo exige uma linha de registro — esquecer
produz erro no boot, não em tempo de escrita; não há detecção automática de
dependência cíclica (o grafo é acíclico por construção da arquitetura, mas nada
o verifica); resolução por string não tem verificação estática.

## Gatilho para revisitar

Se o grafo passar de ~30 nós, ou se surgirem escopos por requisição (um caso de
uso que precise de uma instância diferente por request), um contêiner
estabelecido passa a valer o custo.
