'use strict';

const express = require('express');

const { envolverAsync } = require('../middlewares/envolverAsync');
const { exigirAutenticacao } = require('../middlewares/sessao');
const { limiteDeAutenticacao } = require('../middlewares/limiteDeRequisicoes');

const { AgendaController } = require('../controllers/AgendaController');
const { AutenticacaoController } = require('../controllers/AutenticacaoController');
const { ContatoController } = require('../controllers/ContatoController');
const { AuditoriaController } = require('../controllers/AuditoriaController');
const { PainelController } = require('../controllers/PainelController');
const { CompromissoController } = require('../controllers/CompromissoController');

/**
 * Tabela de rotas.
 *
 * Recebe o container e resolve os casos de uso — os controllers não fazem
 * `require` de implementação concreta alguma, o que os torna testáveis
 * isoladamente com dublês.
 *
 * As URLs são idênticas às da versão anterior: a refatoração é arquitetural,
 * não funcional, e nenhum link existente deixa de funcionar.
 */
function construirRotas(container) {
  const rotas = express.Router();

  const agenda = new AgendaController({
    listarContatos: container.resolver('listarContatos'),
  });

  const autenticacao = new AutenticacaoController({
    cadastrarUsuario: container.resolver('cadastrarUsuario'),
    autenticarUsuario: container.resolver('autenticarUsuario'),
    auditor: container.resolver('auditor'),
    logger: container.resolver('logger'),
  });

  const contato = new ContatoController({
    criarContato: container.resolver('criarContato'),
    editarContato: container.resolver('editarContato'),
    removerContato: container.resolver('removerContato'),
    obterContato: container.resolver('obterContato'),
    alternarFavorito: container.resolver('alternarFavoritoDeContato'),
    exportarContatos: container.resolver('exportarContatos'),
    listarEtiquetasDoUsuario: container.resolver('listarEtiquetasDoUsuario'),
  });

  const auditoria = new AuditoriaController({
    listarAuditoriaDoUsuario: container.resolver('listarAuditoriaDoUsuario'),
  });

  const painel = new PainelController({
    obterPainelDoUsuario: container.resolver('obterPainelDoUsuario'),
  });

  const compromisso = new CompromissoController({
    criarCompromisso: container.resolver('criarCompromisso'),
    editarCompromisso: container.resolver('editarCompromisso'),
    removerCompromisso: container.resolver('removerCompromisso'),
    obterCompromisso: container.resolver('obterCompromisso'),
    listarCalendarioDoUsuario: container.resolver('listarCalendarioDoUsuario'),
    listarContatos: container.resolver('listarContatos'),
    listarEtiquetasDoUsuario: container.resolver('listarEtiquetasDoUsuario'),
  });

  // --- Agenda ---
  rotas.get('/', envolverAsync(agenda.index));

  // --- Autenticação (rate limit dedicado contra brute force) ---
  rotas.get('/login/index', autenticacao.index);
  rotas.get('/cadastro', autenticacao.formularioDeCadastro);
  rotas.post('/login/register', limiteDeAutenticacao, envolverAsync(autenticacao.cadastrar));
  rotas.post('/login/login', limiteDeAutenticacao, envolverAsync(autenticacao.autenticar));
  rotas.post('/login/logout', envolverAsync(autenticacao.encerrarSessao));

  // --- Contatos ---
  // A exportação vem ANTES de `/contato/index/:id`: rota estática primeiro,
  // senão "exportar" seria interpretado como um id de contato.
  rotas.get('/contato/exportar', exigirAutenticacao, envolverAsync(contato.exportar));
  rotas.get('/contato/index', exigirAutenticacao, envolverAsync(contato.formularioNovo));
  rotas.post('/contato/register', exigirAutenticacao, envolverAsync(contato.criar));
  rotas.get('/contato/index/:id', exigirAutenticacao, envolverAsync(contato.formularioEdicao));
  rotas.post('/contato/edit/:id', exigirAutenticacao, envolverAsync(contato.editar));
  // Remoção por POST: como GET, ficava fora do alcance do CSRF (métodos seguros
  // são ignorados) e podia ser disparada por prefetch do navegador.
  rotas.post('/contato/delete/:id', exigirAutenticacao, envolverAsync(contato.remover));
  // Favorito também é mutação de estado: POST + CSRF, nunca GET.
  rotas.post('/contato/favorito/:id', exigirAutenticacao, envolverAsync(contato.favoritar));

  // --- Trilha de auditoria (sempre a do próprio usuário) ---
  rotas.get('/auditoria', exigirAutenticacao, envolverAsync(auditoria.index));

  // --- Painel "Visão geral" ---
  rotas.get('/painel', exigirAutenticacao, envolverAsync(painel.index));

  // --- Compromissos e calendário ---
  rotas.get('/calendario', exigirAutenticacao, envolverAsync(compromisso.calendario));
  rotas.get('/compromisso/index', exigirAutenticacao, envolverAsync(compromisso.formularioNovo));
  rotas.post('/compromisso/register', exigirAutenticacao, envolverAsync(compromisso.criar));
  rotas.get(
    '/compromisso/index/:id',
    exigirAutenticacao,
    envolverAsync(compromisso.formularioEdicao)
  );
  rotas.post('/compromisso/edit/:id', exigirAutenticacao, envolverAsync(compromisso.editar));
  rotas.post('/compromisso/delete/:id', exigirAutenticacao, envolverAsync(compromisso.remover));

  return rotas;
}

module.exports = { construirRotas };
