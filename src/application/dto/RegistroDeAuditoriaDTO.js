'use strict';

/**
 * DTO da trilha de auditoria.
 *
 * O que fica de fora é decisão, não esquecimento:
 *
 *  - **`usuarioId`** — o usuário está vendo a própria trilha; repetir o id dele
 *    em cada linha não informa nada e expõe o identificador no HTML.
 *  - **`userAgent`** — string longa e ruidosa. Fica gravada para investigação,
 *    mas não é exibida.
 *
 * O **IP é exibido**, e é uma escolha a favor do usuário: reconhecer um acesso
 * de origem estranha é justamente o valor de uma trilha pessoal.
 */
class RegistroDeAuditoriaDTO {
  static deEntidade(registro) {
    return Object.freeze({
      id: registro.id.valor,
      acao: registro.acao.valor,
      descricao: registro.acao.descricao,
      categoria: registro.acao.categoria,
      resultado: registro.resultado,
      houveFalha: registro.houveFalha,
      recurso: registro.recurso,
      recursoId: registro.recursoId,
      detalhes: registro.detalhes,
      ip: registro.ip,
      requestId: registro.requestId,
      ocorridoEm: registro.ocorridoEm,
    });
  }

  static deLista(registros) {
    return registros.map(RegistroDeAuditoriaDTO.deEntidade);
  }
}

module.exports = { RegistroDeAuditoriaDTO };
