'use strict';

/**
 * Expõe às views apenas o necessário e protege rotas autenticadas.
 *
 * `req.session.user` guarda somente `{ id, email }` — a projeção vem da
 * entidade (`Usuario.paraSessao`), então não há caminho para o hash da senha
 * chegar à sessão ou ao escopo de um template.
 */
function contextoDeView(req, res, next) {
  res.locals.errors = req.flash('errors');
  res.locals.success = req.flash('success');
  res.locals.user = req.session.user || null;
  res.locals.requestId = req.id;
  // Caminho da requisição para o nav marcar o item ativo. Só o pathname:
  // a query string mudaria o destaque a cada filtro aplicado.
  res.locals.caminhoAtual = req.path;
  next();
}

function exigirAutenticacao(req, res, next) {
  if (!req.session.user) {
    req.flash('errors', 'Você precisa fazer login.');
    return req.session.save(() => res.redirect('/login/index'));
  }
  return next();
}

module.exports = { contextoDeView, exigirAutenticacao };
