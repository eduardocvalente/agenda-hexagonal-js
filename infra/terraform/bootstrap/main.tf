# Bootstrap do backend remoto. Roda UMA vez, por ambiente, com state local —
# é o único diretório que legitimamente não usa backend remoto (ele o cria).
#
#   terraform -chdir=infra/terraform/bootstrap init
#   terraform -chdir=infra/terraform/bootstrap apply -var project=cadastro-usuario

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Component = "tfstate"
    }
  }
}

variable "project" {
  type        = string
  description = "Nome do projeto, usado como prefixo dos recursos."
}

variable "region" {
  type    = string
  default = "us-east-1"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "state" {
  bucket = "${var.project}-tfstate-${data.aws_caller_identity.current.account_id}"

  # O state é a fonte da verdade da infraestrutura: destruí-lo é irreversível.
  lifecycle {
    prevent_destroy = true
  }
}

# Versionamento é o que permite voltar a um state anterior após um apply ruim.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# O state guarda segredos em texto puro (senhas de banco, tokens). Criptografia
# em repouso é obrigatória, não opcional.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    id     = "expirar-versoes-antigas"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_kms_key" "state" {
  description             = "Criptografia do state do Terraform - ${var.project}"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "state" {
  name          = "alias/${var.project}-tfstate"
  target_key_id = aws_kms_key.state.key_id
}

# Lock distribuído: sem ele, dois `apply` simultâneos corrompem o state.
resource "aws_dynamodb_table" "lock" {
  name         = "${var.project}-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }
}

output "backend_config" {
  description = "Cole em environments/<env>/backend.tf"
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.state.id}"
    dynamodb_table = "${aws_dynamodb_table.lock.name}"
    kms_key_id     = "${aws_kms_key.state.arn}"
    region         = "${var.region}"
  EOT
}
