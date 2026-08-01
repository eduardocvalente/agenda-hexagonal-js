'use strict';

/**
 * Seed idempotente: cria o usuário administrador e, opcionalmente, dados de
 * demonstração.
 *
 * Passa pelo MESMO grafo de dependências da aplicação (composition root):
 * a senha atravessa a política de força do domínio e sai com hash bcrypt.
 * Um seed que inserisse direto na collection contornaria as duas coisas —
 * e um dia alguém copiaria esse atalho para código de produção.
 *
 * Variáveis:
 *   ADMIN_EMAIL     e-mail da conta inicial (obrigatória para criar)
 *   ADMIN_PASSWORD  senha da conta inicial (mínimo 12 caracteres, política do domínio)
 *   SEED_DEMO=1     também cria contatos de exemplo para a conta
 *
 * Uso:
 *   npm run seed
 *
 * Rodar duas vezes não duplica nada: cadastro repetido é detectado pelo
 * índice único de e-mail e tratado como "nada a fazer".
 */

const mongoose = require('mongoose');
const config = require('../src/infrastructure/config/env');
const { construirContainer } = require('../src/infrastructure/container/composicao');
const { UsuarioId } = require('../src/domain/value-objects/Identificador');
const { Email } = require('../src/domain/value-objects/Email');

const CONTATOS_DEMO = [
  { nome: 'Maria', sobrenome: 'Silva', email: 'maria.silva@example.com', etiquetas: 'trabalho' },
  { nome: 'João', sobrenome: 'Souza', telefone: '(62) 99999-0001', etiquetas: 'família' },
  {
    nome: 'Ana',
    sobrenome: 'Pereira',
    email: 'ana.pereira@example.com',
    telefone: '(11) 98888-0002',
    etiquetas: 'trabalho, projeto-alfa',
  },
];

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, SEED_DEMO } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('ADMIN_EMAIL e ADMIN_PASSWORD não definidos — nada a semear.');
    console.log('Defina as duas variáveis para criar a conta inicial.');
    return 0;
  }

  await mongoose.connect(config.mongo.uri, { serverSelectionTimeoutMS: 10_000 });
  const container = construirContainer();

  // Índices antes de qualquer escrita: a idempotência do seed depende do
  // índice único de e-mail existir.
  await Promise.all([
    container.resolver('usuarioRepository').garantirIndices(),
    container.resolver('contatoRepository').garantirIndices(),
    container.resolver('auditoriaRepository').garantirIndices(),
  ]);

  const cadastro = await container
    .resolver('cadastrarUsuario')
    .run({ email: ADMIN_EMAIL, senha: ADMIN_PASSWORD });

  // O caso de uso devolve o formato de sessão ({id, email}); a busca devolve a
  // entidade (id é VO). O seed só precisa do id em string — normaliza aqui.
  let usuarioId;
  if (cadastro.isSuccess) {
    usuarioId = cadastro.value.id;
    console.log(`Conta criada: ${ADMIN_EMAIL}`);
  } else {
    // Cadastro recusado por duplicidade é o caminho idempotente esperado.
    // Qualquer outra falha (senha fraca, e-mail inválido) deve parar o script.
    const existente = await container
      .resolver('usuarioRepository')
      .buscarPorEmail(Email.criar(ADMIN_EMAIL).value);
    if (!existente) {
      console.error(`Seed recusado: ${cadastro.error.message}`);
      return 1;
    }
    usuarioId = existente.id.valor;
    console.log(`Conta já existe: ${ADMIN_EMAIL} — nada a fazer.`);
  }

  if (SEED_DEMO === '1') {
    const criarContato = container.resolver('criarContato');
    const proprietarioId = UsuarioId.deConfianca(usuarioId);

    const jaTem = await container
      .resolver('contatoRepository')
      .listarDoProprietario(proprietarioId, { pagina: 1, tamanho: 1 });
    if (jaTem.total > 0) {
      console.log('A conta já tem contatos — demo não será duplicada.');
      return 0;
    }

    for (const dados of CONTATOS_DEMO) {
      // Sequencial de propósito: volume mínimo, e a ordem estável ajuda a
      // conferir o resultado a olho.
      // eslint-disable-next-line no-await-in-loop
      const resultado = await criarContato.run({ proprietarioId, dados });
      console.log(
        resultado.isSuccess
          ? `  contato demo: ${dados.nome} ${dados.sobrenome}`
          : `  falhou ${dados.nome}: ${resultado.error.message}`
      );
    }
  }

  return 0;
}

main()
  .then(async (codigo) => {
    await mongoose.disconnect();
    process.exit(codigo ?? 0);
  })
  .catch(async (err) => {
    console.error('Falha no seed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
