variable "project" {
  type    = string
  default = "cadastro-usuario"
}

variable "environment" {
  type = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Ambientes suportados: staging, production."
  }
}

variable "profile" {
  type        = string
  description = "economico (portfólio/MVP) ou profissional (produção)."
  default     = "profissional"

  validation {
    condition     = contains(["economico", "profissional"], var.profile)
    error_message = "Use economico ou profissional."
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "availability_zones" {
  type = list(string)
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "single_nat_gateway" {
  type    = bool
  default = false
}

variable "enable_vpc_endpoints" {
  type    = bool
  default = false
}

variable "certificate_arn" {
  type        = string
  description = "Certificado ACM validado para o domínio do ambiente."
}

variable "allowed_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "image_tag" {
  type        = string
  description = "Tag da imagem no ECR. O CD sobrescreve isso a cada deploy."
  default     = "latest"
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "cpu_architecture" {
  type    = string
  default = "ARM64"
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "min_capacity" {
  type    = number
  default = 2
}

variable "max_capacity" {
  type    = number
  default = 6
}

variable "requests_per_target" {
  type    = number
  default = 1000
}

variable "capacity_provider_strategy" {
  type = list(object({
    provider = string
    weight   = number
    base     = number
  }))
  default = [{
    provider = "FARGATE"
    weight   = 1
    base     = 1
  }]
}

variable "log_level" {
  type    = string
  default = "info"
}

variable "log_retention_days" {
  type        = number
  description = "Retenção dos logs. Ingestão custa ~US$ 0,50/GB; armazenamento, US$ 0,03/GB/mês."
  default     = 30
}

variable "bcrypt_rounds" {
  type    = number
  default = 12
}

variable "rate_limit_max" {
  type    = number
  default = 300
}

variable "auth_rate_limit_max" {
  type    = number
  default = 10
}

variable "waf_rate_limit" {
  type    = number
  default = 2000
}

variable "access_logs_bucket" {
  type    = string
  default = null
}

variable "keep_last_images" {
  type    = number
  default = 15
}

variable "alert_emails" {
  type    = list(string)
  default = []
}

variable "error_threshold" {
  type    = number
  default = 1
}

variable "latency_p95_threshold_seconds" {
  type    = number
  default = 1.0
}

variable "synthetic_check_fqdn" {
  type    = string
  default = null
}

variable "monthly_budget_usd" {
  type        = number
  description = "Alerta de orçamento mensal. null desativa."
  default     = null
}

variable "cost_center" {
  type    = string
  default = "portfolio"
}

variable "extra_tags" {
  type    = map(string)
  default = {}
}
