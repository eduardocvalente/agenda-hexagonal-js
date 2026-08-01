'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

/**
 * Sobe um MongoDB em memória e monta a aplicação com o grafo real de dependências.
 *
 * As variáveis precisam existir ANTES do primeiro require de `config/env.js`
 * (que valida e congela no carregamento) — por isso os requires ficam dentro da
 * função, e não no topo do arquivo.
 *
 * Os testes de integração usam adaptadores reais de propósito: um repositório
 * falso passaria com uma consulta sem filtro de dono, que é exatamente a classe
 * de defeito que estes testes existem para impedir.
 */
async function startTestApp({ overrides = {} } = {}) {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri('cadastro_test');
  process.env.SESSION_SECRET = 'test-only-secret-0123456789abcdef0123456789';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.LOG_LEVEL = 'silent';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.AUTH_RATE_LIMIT_MAX = '100000';
  process.env.COOKIE_SECURE = 'false';

  const conexao = require('../../src/infrastructure/persistence/mongoose/connection');
  await conexao.connect();

  const { construirContainer } = require('../../src/infrastructure/container/composicao');
  const container = construirContainer({ overrides });

  const { criarAplicacao } = require('../../src/presentation/http/aplicacao');
  const app = criarAplicacao({ container });

  const usuarioRepository = container.resolver('usuarioRepository');
  const contatoRepository = container.resolver('contatoRepository');
  const auditoriaRepository = container.resolver('auditoriaRepository');
  const compromissoRepository = container.resolver('compromissoRepository');

  // Índices únicos precisam existir antes das asserções de unicidade.
  await Promise.all([
    usuarioRepository.garantirIndices(),
    contatoRepository.garantirIndices(),
    auditoriaRepository.garantirIndices(),
    compromissoRepository.garantirIndices(),
  ]);

  return {
    app,
    container,
    models: {
      LoginModel: usuarioRepository.model,
      ContatoModel: contatoRepository.model,
      AuditoriaModel: auditoriaRepository.model,
      CompromissoModel: compromissoRepository.model,
    },
    async stop() {
      await conexao.disconnect();
      await mongod.stop();
    },
    async reset() {
      await Promise.all([
        usuarioRepository.model.deleteMany({}),
        contatoRepository.model.deleteMany({}),
        auditoriaRepository.model.deleteMany({}),
        compromissoRepository.model.deleteMany({}),
      ]);
    },
  };
}

/** Extrai o token CSRF de um formulário renderizado. */
function extractCsrf(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!match) throw new Error('Token CSRF não encontrado na resposta HTML');
  return match[1];
}

/** Autentica um agente supertest e devolve um token CSRF válido para a nova sessão. */
async function signUpAndLogin(request, app, { email, password = 'senha-de-teste-123' } = {}) {
  const agent = request.agent(app);

  const page = await agent.get('/login/index').expect(200);
  const csrf = extractCsrf(page.text);

  await agent
    .post('/login/register')
    .type('form')
    .send({ _csrf: csrf, email, password })
    .expect(302);
  await agent.post('/login/login').type('form').send({ _csrf: csrf, email, password }).expect(302);

  // A sessão foi regenerada no login: é preciso um token novo.
  const home = await agent.get('/contato/index').expect(200);
  return { agent, csrf: extractCsrf(home.text) };
}

module.exports = { startTestApp, extractCsrf, signUpAndLogin };
