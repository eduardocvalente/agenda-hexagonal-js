'use strict';

/**
 * JavaScript da aplicação — mínimo e progressivo.
 *
 * A CSP declara `script-src-attr: 'none'`: handlers inline (`onclick=...`)
 * são bloqueados pelo navegador. Todo comportamento vive aqui, em arquivo
 * próprio servido pelo host (`'self'`), ligado por atributos `data-*`.
 *
 * Sem este arquivo a aplicação continua funcional (progressive enhancement):
 * formulários submetem, links navegam — apenas sem as confirmações.
 */
(function () {
  // Confirmação antes de ações destrutivas: <form data-confirmar="Mensagem?">
  document.addEventListener('submit', function (evento) {
    const form = evento.target;
    if (!(form instanceof HTMLFormElement)) return;

    const mensagem = form.getAttribute('data-confirmar');
    if (mensagem && !window.confirm(mensagem)) {
      evento.preventDefault();
    }
  });

  // Confirmação de senha no cadastro: bloqueia o envio quando os dois campos
  // divergem — o erro clássico de digitar errado num campo mascarado e criar
  // uma conta com senha desconhecida. O servidor revalida.
  document.addEventListener('submit', function (evento) {
    const form = evento.target;
    if (!(form instanceof HTMLFormElement)) return;

    const confirmacao = form.querySelector('[data-confirma-senha-de]');
    if (!confirmacao) return;

    const original = document.getElementById(confirmacao.getAttribute('data-confirma-senha-de'));
    const aviso = document.getElementById('confirmacao-aviso');
    const confere = Boolean(original) && confirmacao.value === original.value;

    if (aviso) aviso.classList.toggle('d-none', confere);
    confirmacao.setAttribute('aria-invalid', String(!confere));

    if (!confere) {
      evento.preventDefault();
      confirmacao.focus();
    }
  });

  // Alternância de tema: <button data-alternar-tema>. O tema efetivo sem
  // escolha manual é o do sistema — a primeira alternância parte dele.
  document.addEventListener('click', function (evento) {
    const botao = evento.target.closest('[data-alternar-tema]');
    if (!botao) return;

    const raiz = document.documentElement;
    const efetivo =
      raiz.getAttribute('data-tema') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
    const novo = efetivo === 'escuro' ? 'claro' : 'escuro';

    raiz.setAttribute('data-tema', novo);
    try {
      window.localStorage.setItem('tema', novo);
    } catch {
      // Sem localStorage a escolha vale só até a próxima navegação.
    }
  });

  // Mostrar/ocultar senha: <button data-alternar-senha="id-do-input">
  document.addEventListener('click', function (evento) {
    const botao = evento.target.closest('[data-alternar-senha]');
    if (!botao) return;

    const campo = document.getElementById(botao.getAttribute('data-alternar-senha'));
    if (!campo) return;

    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    botao.classList.toggle('ativo', mostrar);
    botao.setAttribute('aria-pressed', String(mostrar));
    botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  });

  // Máscaras de entrada: <input data-mascara="telefone|nome">.
  // São conforto de digitação, não validação — a regra fica no servidor.
  function formatarTelefoneBR(digitos) {
    const d = digitos.slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  document.addEventListener('input', function (evento) {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;

    const mascara = campo.getAttribute('data-mascara');
    if (mascara === 'telefone') {
      // Número internacional (começa com +) fica como o usuário digitou.
      if (campo.value.trim().startsWith('+')) return;
      const digitos = campo.value.replace(/\D/g, '');
      campo.value = formatarTelefoneBR(digitos);
    } else if (mascara === 'nome') {
      const semDigitos = campo.value.replace(/\d/g, '');
      if (semDigitos !== campo.value) campo.value = semDigitos;
    }
  });

  // Seletor de etiquetas: transforma o <input data-seletor-de-etiquetas> em
  // chips com sugestões. O input REAL continua no formulário (o servidor não
  // muda) — sem JavaScript, digitar "a, b" segue funcionando.
  function iniciarSeletorDeEtiquetas(entrada) {
    const maximo = 10;
    const wrapper = document.createElement('div');
    wrapper.className = 'chips-etiquetas';

    const digitavel = document.createElement('input');
    digitavel.type = 'text';
    digitavel.className = 'chips-digitavel';
    digitavel.placeholder = 'Digite e pressione Enter';
    digitavel.maxLength = 30;
    digitavel.setAttribute('aria-label', 'Adicionar etiqueta');

    // Sugestões visíveis abaixo do campo (nada de popup nativo, que fica
    // escondido ou corta fora da tela): botões "já usadas" no mesmo form-group.
    const grupo = entrada.closest('.form-group');
    const sugestoes = grupo ? grupo.querySelector('[data-sugestoes-de-etiquetas]') : null;

    entrada.type = 'hidden';
    entrada.parentNode.insertBefore(wrapper, entrada);
    wrapper.appendChild(digitavel);

    function valores() {
      return entrada.value
        .split(',')
        .map(function (v) {
          return v.trim().replace(/\s+/g, ' ').toLowerCase();
        })
        .filter(Boolean)
        .filter(function (v, i, lista) {
          return lista.indexOf(v) === i;
        });
    }

    function desenhar() {
      wrapper.querySelectorAll('.chip').forEach(function (chip) {
        chip.remove();
      });
      valores().forEach(function (valor) {
        const chip = document.createElement('span');
        chip.className = 'chip badge-etiqueta';
        chip.textContent = valor;

        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'chip-remover';
        remover.setAttribute('aria-label', 'Remover etiqueta ' + valor);
        remover.textContent = '×';
        remover.addEventListener('click', function () {
          entrada.value = valores()
            .filter(function (v) {
              return v !== valor;
            })
            .join(', ');
          desenhar();
        });

        chip.appendChild(remover);
        wrapper.insertBefore(chip, digitavel);
      });
      digitavel.disabled = valores().length >= maximo;
      digitavel.placeholder = digitavel.disabled
        ? 'Limite de ' + maximo + ' etiquetas'
        : 'Digite e pressione Enter';

      // Sugestão já escolhida sai da lista — não há por que oferecê-la de novo.
      if (sugestoes) {
        const escolhidas = valores();
        sugestoes.querySelectorAll('[data-sugestao-etiqueta]').forEach(function (botao) {
          botao.classList.toggle(
            'd-none',
            escolhidas.includes(botao.getAttribute('data-sugestao-etiqueta'))
          );
        });
      }
    }

    function adicionarValor(bruto) {
      const valor = String(bruto).trim().replace(/\s+/g, ' ').toLowerCase();
      if (!valor || valores().length >= maximo) return;
      const atuais = valores();
      if (!atuais.includes(valor)) {
        entrada.value = atuais.concat(valor).join(', ');
      }
      desenhar();
    }

    function adicionar() {
      const valor = digitavel.value;
      digitavel.value = '';
      adicionarValor(valor);
    }

    if (sugestoes) {
      sugestoes.addEventListener('click', function (evento) {
        const botao = evento.target.closest('[data-sugestao-etiqueta]');
        if (!botao) return;
        adicionarValor(botao.getAttribute('data-sugestao-etiqueta'));
      });
    }

    digitavel.addEventListener('keydown', function (evento) {
      if (evento.key === 'Enter' || evento.key === ',') {
        evento.preventDefault();
        adicionar();
      } else if (evento.key === 'Backspace' && digitavel.value === '') {
        const atuais = valores();
        entrada.value = atuais.slice(0, -1).join(', ');
        desenhar();
      }
    });
    digitavel.addEventListener('blur', adicionar);

    desenhar();
  }

  document.querySelectorAll('[data-seletor-de-etiquetas]').forEach(iniciarSeletorDeEtiquetas);

  // Medidor de força de senha: <input data-medidor-senha="id-do-medidor">
  // É orientação de UX, não validação — a política real vive no domínio
  // (SenhaEmTexto) e é reaplicada no servidor a cada submissão.
  const NIVEIS = [
    { rotulo: 'Muito fraca', classe: 'nivel-1' },
    { rotulo: 'Fraca', classe: 'nivel-1' },
    { rotulo: 'Razoável', classe: 'nivel-2' },
    { rotulo: 'Boa', classe: 'nivel-3' },
    { rotulo: 'Forte', classe: 'nivel-4' },
  ];

  function medirForca(senha) {
    if (senha.length === 0) return -1;
    let pontos = 0;
    if (senha.length >= 12) pontos += 1;
    if (senha.length >= 16) pontos += 1;
    if (/[a-zA-Z]/.test(senha) && /\d/.test(senha)) pontos += 1;
    if (/[^a-zA-Z0-9]/.test(senha) || (/[a-z]/.test(senha) && /[A-Z]/.test(senha))) pontos += 1;
    // Senha só de repetições ou só dígitos nunca passa de "fraca" —
    // espelha as recusas da política do servidor.
    if (/^(.)\1+$/.test(senha) || /^\d+$/.test(senha)) pontos = Math.min(pontos, 1);
    return pontos;
  }

  document.addEventListener('input', function (evento) {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) return;

    const idDoMedidor = campo.getAttribute('data-medidor-senha');
    if (!idDoMedidor) return;

    const medidor = document.getElementById(idDoMedidor);
    if (!medidor) return;

    const preenchido = medidor.querySelector('.medidor-preenchido');
    const texto = medidor.querySelector('.medidor-texto');
    const pontos = medirForca(campo.value);

    medidor.classList.remove('nivel-1', 'nivel-2', 'nivel-3', 'nivel-4');

    if (pontos < 0) {
      if (preenchido) preenchido.style.width = '0%';
      if (texto)
        texto.textContent = 'Mínimo de 12 caracteres. Evite sequências numéricas ou repetições.';
      return;
    }

    const nivel = NIVEIS[pontos];
    medidor.classList.add(nivel.classe);
    if (preenchido) preenchido.style.width = String(Math.max(pontos, 1) * 25) + '%';
    if (texto) texto.textContent = 'Força da senha: ' + nivel.rotulo;
  });
})();
