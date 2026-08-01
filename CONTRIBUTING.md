# Contribuições

Este é um **projeto pessoal de portfólio**, mantido por Eduardo Valente para
demonstração técnica. Ele não segue o modelo de contribuição aberta.

## Pull requests externos

Não são aceitos. O código está sob [licença proprietária](LICENSE) e não pode
ser modificado ou redistribuído por terceiros.

## Encontrou um problema ou tem uma sugestão?

Feedback é bem-vindo. Abra uma [issue](../../issues) descrevendo:

- o que observou (bug, dúvida de arquitetura, sugestão);
- como reproduzir, se for um defeito;
- o comportamento esperado.

## Padrões do projeto (referência)

Caso queira entender como o projeto é mantido:

- **Commits** seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/)
  (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- **Branches** — `main` protegida; trabalho em `feat/*`, `fix/*`, `chore/*`.
- **Antes de qualquer commit** — `npm run lint`, `npm run format:check`, `npm test`
  precisam passar.
- **Versionamento** — [SemVer](https://semver.org/lang/pt-BR/).
- **Decisões de arquitetura** são registradas como ADRs em [`docs/adr/`](docs/adr/).
