variable "name" {
  type        = string
  description = "Prefixo dos recursos (ex.: cadastro-usuario-staging)."

  validation {
    condition     = can(regex("^[a-z0-9-]{3,40}$", var.name))
    error_message = "Use apenas minúsculas, números e hífen (3 a 40 caracteres)."
  }
}

variable "region" {
  type        = string
  description = "Região AWS."
}

variable "cidr_block" {
  type        = string
  description = "CIDR da VPC. /16 comporta 256 subnets /24."
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrhost(var.cidr_block, 0)) && tonumber(split("/", var.cidr_block)[1]) <= 20
    error_message = "Informe um CIDR válido com máscara /20 ou maior."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "AZs a utilizar. Mínimo de 2 para alta disponibilidade do ALB."

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "O ALB exige subnets em ao menos duas zonas de disponibilidade."
  }
}

variable "enable_nat_gateway" {
  type        = bool
  description = "NAT Gateway para saída das subnets privadas. Desligado, a aplicação precisa rodar em subnet pública."
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Um único NAT compartilhado (mais barato, ponto único de falha)."
  default     = false
}

variable "assign_public_ip_on_launch" {
  type        = bool
  description = "IP público automático nas subnets públicas (cenário econômico sem NAT)."
  default     = false
}

variable "enable_vpc_endpoints" {
  type        = bool
  description = "Endpoints para ECR/Logs/Secrets/S3, reduzindo tráfego pelo NAT."
  default     = false
}

variable "enable_flow_logs" {
  type        = bool
  description = "VPC Flow Logs (apenas REJECT, para conter custo de ingestão)."
  default     = true
}

variable "flow_log_retention_days" {
  type        = number
  description = "Retenção dos flow logs no CloudWatch."
  default     = 30
}

variable "tags" {
  type        = map(string)
  description = "Tags aplicadas a todos os recursos."
  default     = {}
}
