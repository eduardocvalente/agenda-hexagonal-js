'use strict';

const { Container } = require('./Container');

const config = require('../config/env');
const pino = require('../config/logger');
const { PinoLogger } = require('../logger/PinoLogger');
const { BcryptServicoDeHash } = require('../security/BcryptServicoDeHash');
const { MongooseUsuarioRepository } = require('../persistence/mongoose/MongooseUsuarioRepository');
const { MongooseContatoRepository } = require('../persistence/mongoose/MongooseContatoRepository');
const {
  MongooseAuditoriaRepository,
} = require('../persistence/mongoose/MongooseAuditoriaRepository');
const {
  MongooseCompromissoRepository,
} = require('../persistence/mongoose/MongooseCompromissoRepository');
const { ServicoDeAuditoria } = require('../../application/services/ServicoDeAuditoria');

const { CadastrarUsuario } = require('../../application/use-cases/usuario/CadastrarUsuario');
const { AutenticarUsuario } = require('../../application/use-cases/usuario/AutenticarUsuario');
const { CriarContato } = require('../../application/use-cases/contato/CriarContato');
const { EditarContato } = require('../../application/use-cases/contato/EditarContato');
const { RemoverContato } = require('../../application/use-cases/contato/RemoverContato');
const { ListarContatos } = require('../../application/use-cases/contato/ListarContatos');
const { ObterContato } = require('../../application/use-cases/contato/ObterContato');
const {
  AlternarFavoritoDeContato,
} = require('../../application/use-cases/contato/AlternarFavoritoDeContato');
const { ObterPainelDoUsuario } = require('../../application/use-cases/painel/ObterPainelDoUsuario');
const { ExportarContatos } = require('../../application/use-cases/contato/ExportarContatos');
const { CriarCompromisso } = require('../../application/use-cases/compromisso/CriarCompromisso');
const { EditarCompromisso } = require('../../application/use-cases/compromisso/EditarCompromisso');
const {
  RemoverCompromisso,
} = require('../../application/use-cases/compromisso/RemoverCompromisso');
const { ObterCompromisso } = require('../../application/use-cases/compromisso/ObterCompromisso');
const {
  ListarCalendarioDoUsuario,
} = require('../../application/use-cases/compromisso/ListarCalendarioDoUsuario');
const {
  ListarEtiquetasDoUsuario,
} = require('../../application/use-cases/etiquetas/ListarEtiquetasDoUsuario');
const {
  ListarAuditoriaDoUsuario,
} = require('../../application/use-cases/auditoria/ListarAuditoriaDoUsuario');

/**
 * Cabeamento do grafo de dependências.
 *
 * A leitura de cima para baixo mostra a arquitetura inteira: adaptadores
 * primeiro, casos de uso depois, cada um recebendo portas — nunca implementações
 * concretas. Nenhum caso de uso menciona Mongoose, bcrypt ou pino.
 */
function construirContainer({ overrides = {} } = {}) {
  const container = new Container();

  // --- Configuração e observabilidade ---
  container.registrarValor('config', config);
  container.registrarSingleton('logger', () => new PinoLogger(pino));

  // --- Adaptadores de saída (portas → implementações) ---
  container.registrarSingleton(
    'servicoDeHash',
    (c) => new BcryptServicoDeHash({ custo: c.resolver('config').security.bcryptRounds })
  );
  container.registrarSingleton('usuarioRepository', () => new MongooseUsuarioRepository());
  container.registrarSingleton('contatoRepository', () => new MongooseContatoRepository());
  container.registrarSingleton('auditoriaRepository', () => new MongooseAuditoriaRepository());
  container.registrarSingleton('compromissoRepository', () => new MongooseCompromissoRepository());

  // Serviço de aplicação (não é caso de uso: não representa uma intenção do
  // usuário, é um efeito transversal de várias delas).
  container.registrarSingleton(
    'auditor',
    (c) =>
      new ServicoDeAuditoria({
        auditoriaRepository: c.resolver('auditoriaRepository'),
        logger: c.resolver('logger'),
      })
  );

  // --- Casos de uso ---
  const casosDeUso = {
    cadastrarUsuario: (c) =>
      new CadastrarUsuario({
        usuarioRepository: c.resolver('usuarioRepository'),
        servicoDeHash: c.resolver('servicoDeHash'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    autenticarUsuario: (c) =>
      new AutenticarUsuario({
        usuarioRepository: c.resolver('usuarioRepository'),
        servicoDeHash: c.resolver('servicoDeHash'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    criarContato: (c) =>
      new CriarContato({
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    editarContato: (c) =>
      new EditarContato({
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    removerContato: (c) =>
      new RemoverContato({
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    listarAuditoriaDoUsuario: (c) =>
      new ListarAuditoriaDoUsuario({
        auditoriaRepository: c.resolver('auditoriaRepository'),
        logger: c.resolver('logger'),
      }),
    listarContatos: (c) =>
      new ListarContatos({
        contatoRepository: c.resolver('contatoRepository'),
        logger: c.resolver('logger'),
      }),
    obterContato: (c) =>
      new ObterContato({
        contatoRepository: c.resolver('contatoRepository'),
        logger: c.resolver('logger'),
      }),
    alternarFavoritoDeContato: (c) =>
      new AlternarFavoritoDeContato({
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    obterPainelDoUsuario: (c) =>
      new ObterPainelDoUsuario({
        contatoRepository: c.resolver('contatoRepository'),
        compromissoRepository: c.resolver('compromissoRepository'),
        auditoriaRepository: c.resolver('auditoriaRepository'),
        logger: c.resolver('logger'),
      }),
    exportarContatos: (c) =>
      new ExportarContatos({
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    criarCompromisso: (c) =>
      new CriarCompromisso({
        compromissoRepository: c.resolver('compromissoRepository'),
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    editarCompromisso: (c) =>
      new EditarCompromisso({
        compromissoRepository: c.resolver('compromissoRepository'),
        contatoRepository: c.resolver('contatoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    removerCompromisso: (c) =>
      new RemoverCompromisso({
        compromissoRepository: c.resolver('compromissoRepository'),
        auditor: c.resolver('auditor'),
        logger: c.resolver('logger'),
      }),
    obterCompromisso: (c) =>
      new ObterCompromisso({
        compromissoRepository: c.resolver('compromissoRepository'),
        logger: c.resolver('logger'),
      }),
    listarCalendarioDoUsuario: (c) =>
      new ListarCalendarioDoUsuario({
        compromissoRepository: c.resolver('compromissoRepository'),
        logger: c.resolver('logger'),
      }),
    listarEtiquetasDoUsuario: (c) =>
      new ListarEtiquetasDoUsuario({
        contatoRepository: c.resolver('contatoRepository'),
        compromissoRepository: c.resolver('compromissoRepository'),
        logger: c.resolver('logger'),
      }),
  };

  for (const [nome, fabrica] of Object.entries(casosDeUso)) {
    container.registrarSingleton(nome, fabrica);
  }

  // Substituições de teste entram por último, sobrepondo qualquer registro.
  for (const [nome, valor] of Object.entries(overrides)) {
    container.substituir(nome, valor);
  }

  return container;
}

module.exports = { construirContainer };
