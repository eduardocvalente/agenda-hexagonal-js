'use strict';

/*
 * Agenda de Contatos
 * Copyright (c) 2026 Eduardo Valente. Todos os direitos reservados.
 *
 * Projeto de portfólio sob licença proprietária. Uso, cópia, modificação ou
 * redistribuição sem autorização por escrito são proibidos. Ver LICENSE.
 */

const config = require('./src/infrastructure/config/env');
const logger = require('./src/infrastructure/config/logger');
const conexao = require('./src/infrastructure/persistence/mongoose/connection');
const { criarAplicacao } = require('./src/presentation/http/aplicacao');

/**
 * Ponto de entrada do processo.
 *
 * Responsabilidades exclusivas: abrir a conexão, subir o servidor e encerrar de
 * forma ordenada. Não conhece rotas, controllers nem regras — a composição está
 * em `infrastructure/container/composicao.js` e a aplicação HTTP em
 * `presentation/http/aplicacao.js`.
 */
async function bootstrap() {
  await conexao.connect();

  const app = criarAplicacao();
  const server = app.listen(config.port, () => {
    logger.info(
      { evento: 'server.iniciado', porta: config.port, ambiente: config.nodeEnv },
      'Servidor no ar'
    );
  });

  // Maior que o idle timeout do ALB (60 s). Sem essa folga, existe uma corrida
  // em que o balanceador reusa uma conexão que o Node acabou de fechar — o
  // resultado é um 502 esporádico e difícil de reproduzir.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let encerrando = false;

  async function encerrar(sinal) {
    if (encerrando) return;
    encerrando = true;
    logger.info({ evento: 'server.encerramento_iniciado', sinal }, 'Encerrando graciosamente');

    const saidaForcada = setTimeout(() => {
      logger.error(
        { evento: 'server.encerramento_timeout' },
        'Timeout no shutdown, forçando saída'
      );
      process.exit(1);
    }, config.shutdownTimeoutMs);
    saidaForcada.unref();

    try {
      await new Promise((resolve, reject) =>
        server.close((erro) => (erro ? reject(erro) : resolve()))
      );
      await conexao.disconnect();
      logger.info({ evento: 'server.encerramento_concluido' }, 'Encerrado');
      process.exit(0);
    } catch (erro) {
      logger.error({ evento: 'server.encerramento_erro', err: erro }, 'Erro durante o shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));

  // O estado do processo é indeterminado após estes eventos. Registrar e sair
  // deixa o orquestrador recriar o container, em vez de manter no ar uma
  // instância possivelmente corrompida.
  process.on('uncaughtException', (erro) => {
    logger.fatal({ evento: 'process.excecao_nao_tratada', err: erro }, 'Exceção não tratada');
    encerrar('uncaughtException');
  });
  process.on('unhandledRejection', (motivo) => {
    logger.fatal(
      { evento: 'process.rejeicao_nao_tratada', err: motivo },
      'Promise rejeitada sem tratamento'
    );
    encerrar('unhandledRejection');
  });

  return server;
}

bootstrap().catch((erro) => {
  logger.fatal(
    { evento: 'server.bootstrap_falhou', err: erro },
    'Falha ao inicializar a aplicação'
  );
  process.exit(1);
});
