# State remoto com lock. Os valores vêm do output `backend_config` do diretório
# bootstrap — substitua o ID da conta antes do primeiro init.
#
#   terraform init \
#     -backend-config="bucket=cadastro-usuario-tfstate-<account-id>" \
#     -backend-config="dynamodb_table=cadastro-usuario-tflock"
#
# Nunca use state local em ambiente compartilhado: sem lock, dois applies
# simultâneos corrompem o arquivo e a recuperação é manual.

terraform {
  backend "s3" {
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cadastro-usuario-tflock"
    # bucket informado via -backend-config (depende do ID da conta)
  }
}
