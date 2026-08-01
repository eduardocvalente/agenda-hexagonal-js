terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# SESSION_SECRET é gerado pelo Terraform e nunca digitado por ninguém.
# Fica no state (por isso o bucket é criptografado com KMS) mas não em git,
# não em variável de ambiente do CI e não no console.
resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "session" {
  name                    = "${var.name}/session-secret"
  description             = "Segredo de assinatura dos cookies de sessão"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "session" {
  secret_id     = aws_secretsmanager_secret.session.id
  secret_string = random_password.session_secret.result

  lifecycle {
    # Rotação manual não deve ser revertida pelo próximo apply.
    ignore_changes = [secret_string]
  }
}

# A URI do MongoDB (Atlas ou DocumentDB) é criada vazia pelo Terraform e
# preenchida fora dele — a credencial do banco não passa pelo pipeline.
resource "aws_secretsmanager_secret" "mongodb_uri" {
  name                    = "${var.name}/mongodb-uri"
  description             = "String de conexão do MongoDB (preencher manualmente ou via provider do Atlas)"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "mongodb_uri" {
  secret_id     = aws_secretsmanager_secret.mongodb_uri.id
  secret_string = var.mongodb_uri_placeholder

  lifecycle {
    ignore_changes = [secret_string]
  }
}

variable "name" {
  type = string
}

variable "kms_key_id" {
  type        = string
  description = "Chave KMS. null usa a chave gerenciada pela AWS (aws/secretsmanager)."
  default     = null
}

variable "recovery_window_in_days" {
  type        = number
  description = "Janela de recuperação após delete. 0 apaga na hora — use só em ambientes descartáveis."
  default     = 30
}

variable "mongodb_uri_placeholder" {
  type      = string
  default   = "PREENCHER"
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}

output "session_secret_arn" {
  value = aws_secretsmanager_secret.session.arn
}

output "mongodb_uri_arn" {
  value = aws_secretsmanager_secret.mongodb_uri.arn
}

output "all_arns" {
  value = [
    aws_secretsmanager_secret.session.arn,
    aws_secretsmanager_secret.mongodb_uri.arn,
  ]
}
