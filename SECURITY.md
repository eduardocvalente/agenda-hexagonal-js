# Política de Segurança

## Reporte de vulnerabilidades

Se você identificar uma vulnerabilidade neste projeto, **não abra uma issue
pública**. Use o canal privado do GitHub:

**Security → Report a vulnerability** (GitHub Private Vulnerability Reporting)

Inclua:

- descrição da vulnerabilidade e do impacto;
- passos para reproduzir;
- versão ou commit afetado.

O objetivo de resposta é de até 7 dias corridos.

## Escopo

Este é um projeto de portfólio. Existe um ambiente de demonstração em
<https://agenda.eduardovalente.dev>, hospedado em plano gratuito e sem dados
reais de terceiros. Reportes sobre o código-fonte e sobre a demonstração são
bem-vindos pelo canal privado acima; **testes intrusivos, de negação de serviço
ou automação de carga contra a demonstração não estão autorizados**.

## Práticas de segurança já adotadas

O projeto foi construído com segurança como requisito de primeira classe:

- autenticação com bcrypt e regeneração de sessão no login (anti session fixation);
- proteção CSRF própria com comparação em tempo constante;
- proteção contra enumeração de contas (mensagem e tempo de resposta uniformes);
- rate limiting global e específico para autenticação;
- Content Security Policy explícita e cabeçalhos de segurança via helmet;
- sanitização de entrada contra NoSQL injection;
- segredos fora do código, validados no boot;
- trilha de auditoria com redação automática de dados sensíveis;
- scan de dependências (`npm audit`) e análise estática (CodeQL) no CI.
