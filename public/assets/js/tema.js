'use strict';

/**
 * Aplicação do tema salvo — carregado SEM defer, no <head>, de propósito.
 *
 * Se este código rodasse depois da pintura (defer/DOMContentLoaded), quem
 * escolheu tema escuro veria a página piscar em claro a cada navegação
 * (FOUC). O custo é um script minúsculo e bloqueante, e é o padrão da
 * indústria para inicialização de tema.
 *
 * Sem escolha salva, nada é feito: o CSS segue prefers-color-scheme.
 */
(function () {
  try {
    const tema = window.localStorage.getItem('tema');
    if (tema === 'claro' || tema === 'escuro') {
      document.documentElement.setAttribute('data-tema', tema);
    }
  } catch {
    // localStorage indisponível (modo privado restrito): segue o sistema.
  }
})();
