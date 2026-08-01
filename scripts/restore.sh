#!/usr/bin/env bash
#
# Restore a partir de um backup gerado por scripts/backup.sh.
#
# Por padrão restaura em um banco TEMPORÁRIO e roda verificações — este é o
# modo do teste mensal de restore. Sobrescrever o banco alvo exige
# --target-uri explícito e confirmação digitada.
#
# Uso:
#   ./scripts/restore.sh s3://bucket/backups/20260731T030000Z
#   ./scripts/restore.sh s3://bucket/backups/20260731T030000Z --target-uri "mongodb://..." --confirm
#
# Dependências: mongorestore, mongosh, aws-cli, age.

set -Eeuo pipefail

SOURCE="${1:?informe o prefixo S3 do backup}"
shift || true

TARGET_URI=""
CONFIRMED="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --target-uri) TARGET_URI="$2"; shift 2 ;;
    --confirm) CONFIRMED="true"; shift ;;
    *) echo "Argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done

: "${BACKUP_AGE_IDENTITY:?defina BACKUP_AGE_IDENTITY (arquivo com a chave privada age)}"

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }

log "Baixando ${SOURCE}"
aws s3 cp "${SOURCE}" "${WORKDIR}/" --recursive --only-show-errors

ENCRYPTED=$(find "${WORKDIR}" -name '*.archive.gz.age' | head -1)
[ -n "${ENCRYPTED}" ] || { log "ERRO: nenhum arquivo .archive.gz.age encontrado."; exit 1; }

if [ -f "${WORKDIR}/SHA256SUMS" ]; then
  log "Verificando integridade"
  (cd "${WORKDIR}" && sha256sum -c SHA256SUMS)
else
  log "AVISO: SHA256SUMS ausente — integridade não verificada."
fi

log "Descriptografando"
age --decrypt --identity "${BACKUP_AGE_IDENTITY}" --output "${WORKDIR}/dump.archive.gz" "${ENCRYPTED}"

if [ -n "${TARGET_URI}" ]; then
  if [ "${CONFIRMED}" != "true" ]; then
    log "ERRO: restaurar em ${TARGET_URI} sobrescreve dados. Repita com --confirm."
    exit 1
  fi
  log "ATENÇÃO: restaurando no banco informado em 10s. Ctrl+C para abortar."
  sleep 10
  DEST_URI="${TARGET_URI}"
  EXTRA_ARGS="--drop"
else
  # Modo verificação: instância descartável na porta 27099.
  log "Modo verificação: subindo mongod temporário"
  mkdir -p "${WORKDIR}/db"
  mongod --dbpath "${WORKDIR}/db" --port 27099 --bind_ip 127.0.0.1 --fork \
    --logpath "${WORKDIR}/mongod.log"
  DEST_URI="mongodb://127.0.0.1:27099/verificacao"
  EXTRA_ARGS=""
  trap 'mongod --dbpath "${WORKDIR}/db" --shutdown >/dev/null 2>&1 || true; cleanup' EXIT
fi

log "Restaurando"
# shellcheck disable=SC2086
mongorestore --uri="${DEST_URI}" --archive="${WORKDIR}/dump.archive.gz" --gzip ${EXTRA_ARGS}

log "Validando conteúdo restaurado"
mongosh "${DEST_URI}" --quiet --eval '
  const logins = db.logins.countDocuments();
  const contatos = db.contatos.countDocuments();
  print(`logins=${logins} contatos=${contatos}`);
  if (logins === 0) { print("FALHA: nenhuma conta restaurada"); quit(1); }
  const orfaos = db.contatos.countDocuments({ user: { $exists: false } });
  if (orfaos > 0) { print(`AVISO: ${orfaos} contato(s) sem dono — migration 0001 não foi aplicada neste dump`); }
  const semIndice = db.logins.getIndexes().filter(i => i.name === "uniq_email").length === 0;
  if (semIndice) { print("AVISO: índice único de e-mail ausente — rode npm run migrate"); }
  print("Restore validado.");
'

log "Restore concluído com sucesso."
log "Restore validado. Registre a data deste teste no seu controle operacional."
