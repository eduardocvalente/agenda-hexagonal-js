'use strict';

/**
 * Serialização de contatos em CSV.
 *
 * Três decisões deliberadas:
 *
 *  - **Separador `;`** — o Excel em português trata vírgula como decimal e só
 *    abre CSV com ponto-e-vírgula corretamente. O público do produto é pt-BR.
 *  - **BOM UTF-8** — sem os três bytes iniciais, o Excel no Windows abre
 *    acentos corrompidos (á vira Ã¡). O BOM é o sinal que ele entende.
 *  - **Neutralização de fórmulas** — célula começando com `=`, `+`, `-` ou `@`
 *    é executada como fórmula pelo Excel (CSV injection). Um contato chamado
 *    `=HYPERLINK(...)` viraria código rodando na máquina do usuário; o
 *    apóstrofo prefixado faz o Excel tratar como texto.
 */
class ContatoCSV {
  static CABECALHO = ['nome', 'sobrenome', 'email', 'telefone', 'etiquetas', 'favorito'];

  static gerar(contatos) {
    const linhas = [
      ContatoCSV.CABECALHO.join(';'),
      ...contatos.map((contato) =>
        [
          ContatoCSV.#celula(contato.nome.nome),
          ContatoCSV.#celula(contato.nome.sobrenome),
          ContatoCSV.#celula(contato.email?.valor ?? ''),
          ContatoCSV.#celula(contato.telefone?.valor ?? ''),
          ContatoCSV.#celula(contato.etiquetas.texto),
          contato.favorito ? 'sim' : 'não',
        ].join(';')
      ),
    ];

    const BOM_UTF8 = '﻿';
    return BOM_UTF8 + linhas.join('\r\n') + '\r\n';
  }

  static #celula(valor) {
    let texto = String(valor ?? '');

    // Neutraliza CSV injection antes de qualquer outra coisa.
    if (/^[=+\-@\t\r]/.test(texto)) {
      texto = `'${texto}`;
    }

    // Aspas duplas dobradas + campo entre aspas quando contém separador,
    // aspas ou quebra de linha — RFC 4180.
    if (/[";\n\r]/.test(texto)) {
      texto = `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
  }
}

module.exports = { ContatoCSV };
