#!/usr/bin/env bash
#
# Backup lógico do MongoDB, criptografado e enviado para o S3.
#
# Complementa — não substitui — os snapshots do provedor. Snapshot protege
# contra falha de infraestrutura; dump lógico protege contra o caso mais comum
# em aplicações pequenas: alguém apagou dados por engano e o problema só foi
# notado dias depois.
#
# Uso:
#   MONGODB_URI=... BACKUP_BUCKET=s3://meu-bucket/backups \
#   BACKUP_AGE_RECIPIENT=age1... ./scripts/backup.sh
#
# Dependências: mongodump (mongodb-database-tools), aws-cli, age.

set -Eeuo pipefail

: "${MONGODB_URI:?defina MONGODB_URI}"
: "${BACKUP_BUCKET:?defina BACKUP_BUCKET (ex.: s3://bucket/backups)}"
: "${BACKUP_AGE_RECIPIENT:?defina BACKUP_AGE_RECIPIENT (chave pública age)}"

RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
ARCHIVE="${WORKDIR}/mongo-${TIMESTAMP}.archive.gz"

# O diretório temporário some mesmo se o script falhar no meio: um dump com
# dados de produção não pode ficar esquecido no disco do runner.
cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }

log "Iniciando dump"
mongodump --uri="${MONGODB_URI}" --archive="${ARCHIVE}" --gzip --readPreference=secondaryPreferred

SIZE=$(wc -c <"${ARCHIVE}")
if [ "${SIZE}" -lt 1024 ]; then
  log "ERRO: dump com ${SIZE} bytes — provavelmente vazio. Abortando."
  exit 1
fi
log "Dump concluído (${SIZE} bytes)"

# Criptografia do lado do cliente: o backup já sobe cifrado, independente de a
# criptografia do bucket estar configurada corretamente.
log "Criptografando"
age --encrypt --recipient "${BACKUP_AGE_RECIPIENT}" --output "${ARCHIVE}.age" "${ARCHIVE}"
rm -f "${ARCHIVE}"

CHECKSUM=$(sha256sum "${ARCHIVE}.age" | cut -d' ' -f1)
log "SHA-256: ${CHECKSUM}"

DEST="${BACKUP_BUCKET}/${TIMESTAMP}/"
log "Enviando para ${DEST}"
aws s3 cp "${ARCHIVE}.age" "${DEST}" --only-show-errors
printf '%s  %s\n' "${CHECKSUM}" "$(basename "${ARCHIVE}.age")" >"${WORKDIR}/SHA256SUMS"
aws s3 cp "${WORKDIR}/SHA256SUMS" "${DEST}" --only-show-errors

# Verifica que o objeto realmente existe no destino. "O comando não deu erro"
# não é evidência suficiente de que o backup foi gravado.
if ! aws s3 ls "${DEST}" >/dev/null; then
  log "ERRO: objeto não encontrado no destino após o upload."
  exit 1
fi

log "Backup concluído: ${DEST}"
log "Retenção de ${RETENTION_DAYS} dias é aplicada pela lifecycle policy do bucket."
log "LEMBRETE: um backup só conta como válido depois de um restore testado (scripts/restore.sh)."
