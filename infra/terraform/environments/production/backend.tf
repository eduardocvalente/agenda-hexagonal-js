# State de produção — arquivo separado do de staging, com lock e versionamento.
#
#   terraform init \
#     -backend-config="bucket=cadastro-usuario-tfstate-<account-id>" \
#     -backend-config="dynamodb_table=cadastro-usuario-tflock"

terraform {
  backend "s3" {
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cadastro-usuario-tflock"
  }
}
