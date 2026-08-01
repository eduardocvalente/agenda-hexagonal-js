# ADR-0006 — Arquitetura Hexagonal (Ports & Adapters)

**Data:** 31/07/2026 · **Status:** Aceito · **Substitui:** parte do [ADR-0001](0001-manter-monolito-modular.md)

## Contexto

O ADR-0001 recomendou manter o monólito com organização por tipo
(`controllers`, `models`, `middleware`), argumentando que Clean Architecture
seria overengineering para 4 entidades e ~500 linhas de domínio.

**Esse argumento continua tecnicamente correto** pelo critério de custo de
manutenção. O que mudou foi o critério: o objetivo declarado do projeto é servir
de peça de portfólio avaliada por recrutadores técnicos. Sob esse critério, a
capacidade de demonstrar domínio de separação de responsabilidades, inversão de
dependência e testabilidade é o próprio produto.

Decisão tomada com o trade-off explícito, não por desconhecê-lo.

## Decisão

Hexagonal (Ports & Adapters), com quatro camadas concêntricas — `domain`,
`application`, `infrastructure`, `presentation` — mais `shared` transversal.

## Por que Hexagonal e não Clean ou Onion

As três impõem a mesma regra de dependência e produziriam quase o mesmo grafo.
A escolha é de vocabulário:

- **Clean Architecture** separa "Interface Adapters" de "Frameworks & Drivers".
  Aqui os dois colapsam: o adaptador HTTP _é_ o Express. Um anel a mais sem
  conteúdo próprio.
- **Onion** destaca "Domain Services" como anel. Existe **um** serviço de
  domínio puro no projeto. O anel ficaria quase vazio.
- **Hexagonal** nomeia exatamente o que existe: um dentro (regras) e um fora
  (HTTP, banco, hash, log), ligados por portas e adaptadores.

## Consequências

**Positivas**

- Domínio testável sem banco: 51 testes unitários rodam em menos de 100 ms;
- trocar Mongoose por outro ORM não toca em nenhum caso de uso — a verificação é
  objetiva: `grep -r "mongoose" src/domain src/application` não retorna nada;
- o `Contato` passa a garantir por construção que todo contato tem dono, o que
  antes dependia de disciplina em cada consulta;
- fronteiras explícitas mostram onde uma funcionalidade nova deve entrar.

**Negativas — e são reais**

- **Mais arquivos.** De 31 para 72 em `src/`. Uma alteração que antes tocava
  um arquivo pode tocar quatro.
- **Indireção.** Rastrear `POST /contato/register` até o banco passa por rota →
  controller → caso de uso → entidade → repositório → mapper.
- **Cerimônia em casos triviais.** `ObterContato` é um caso de uso de poucas
  linhas que só delega à porta de persistência.
- **Curva de entrada.** Quem conhece o padrão MVC de tutorial precisa de tempo
  para se orientar.

Nenhuma dessas é acidental. São o preço da separação, e o preço é justo **para
o objetivo declarado** — não seria para um MVP de duas semanas com prazo.

## Verificação

Os 43 testes de integração pré-existentes passaram sem uma linha alterada. Isso
é a evidência de que a refatoração preservou comportamento: eles exercitam o
sistema via HTTP, então não sabem nem se importam com a estrutura interna.
