terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

resource "aws_ecr_repository" "this" {
  name = var.name

  # IMMUTABLE: uma tag nunca aponta para outra imagem depois de publicada.
  # É o que impede que `:latest` mude por baixo de um rollback.
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = var.tags
}

# Sem lifecycle policy o repositório cresce indefinidamente a US$ 0,10/GB/mês.
resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Manter as ${var.keep_last_images} imagens mais recentes"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "sha", "main"]
          countType     = "imageCountMoreThan"
          countNumber   = var.keep_last_images
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expirar imagens sem tag após 7 dias"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

variable "name" {
  type = string
}

variable "keep_last_images" {
  type        = number
  description = "Quantas imagens tagueadas manter. Precisa cobrir a janela de rollback."
  default     = 15
}

variable "tags" {
  type    = map(string)
  default = {}
}

output "repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "repository_arn" {
  value = aws_ecr_repository.this.arn
}
