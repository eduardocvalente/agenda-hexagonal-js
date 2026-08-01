terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Pessimista no minor: pega correções de bug sem herdar breaking changes
      # de um major novo em um apply de sexta-feira.
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region

  # Tags padrão em todo recurso que as suporta — base do rateio de custo e da
  # identificação de órfãos.
  default_tags {
    tags = {
      Project     = var.project
      Environment = "staging"
      ManagedBy   = "terraform"
      Repository  = "cadastro_usuario"
    }
  }
}
