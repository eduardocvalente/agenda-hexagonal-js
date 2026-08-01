'use strict';

const express = require('express');
const conexao = require('../../../infrastructure/persistence/mongoose/connection');

const rotas = express.Router();
const iniciadoEm = Date.now();

/**
 * Liveness: "o processo está vivo?".
 *
 * Não toca em dependência alguma — se tocasse, um banco lento faria o
 * orquestrador matar containers perfeitamente saudáveis, transformando
 * degradação em indisponibilidade.
 */
rotas.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor((Date.now() - iniciadoEm) / 1000) });
});

/**
 * Readiness: "posso receber tráfego?".
 *
 * Aqui as dependências entram: sem Mongo, a instância sai do balanceador em vez
 * de responder 500 ao usuário.
 */
rotas.get('/readyz', async (req, res) => {
  const verificacoes = { mongo: 'down' };
  try {
    await conexao.ping();
    verificacoes.mongo = 'up';
  } catch {
    verificacoes.mongo = 'down';
  }

  const pronto = Object.values(verificacoes).every((v) => v === 'up');
  res.status(pronto ? 200 : 503).json({
    status: pronto ? 'ready' : 'not_ready',
    checks: verificacoes,
  });
});

module.exports = rotas;
