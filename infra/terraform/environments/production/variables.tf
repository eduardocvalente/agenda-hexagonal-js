variable "project" {
  type    = string
  default = "cadastro-usuario"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "availability_zones" {
  type        = list(string)
  description = "Mínimo de 2 AZs. Três reduz o impacto de perder uma zona sob carga."
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "Produção exige ao menos duas zonas de disponibilidade."
  }
}

variable "certificate_arn" {
  type        = string
  description = "Certificado ACM validado, na mesma região do ALB."
}

variable "domain_name" {
  type        = string
  description = "Domínio público da aplicação."
}

variable "hosted_zone_id" {
  type        = string
  description = "Zona do Route 53. null se o DNS é gerenciado fora da AWS."
  default     = null
}

variable "access_logs_bucket" {
  type        = string
  description = "Bucket para logs de acesso do ALB. Necessário para investigação forense."
  default     = null
}

variable "image_tag" {
  type        = string
  description = "Tag/digest da imagem. Em produção, prefira o SHA do commit a 'latest'."
}

variable "alert_emails" {
  type = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "Produção sem destinatário de alarme é produção sem monitoramento."
  }
}

variable "monthly_budget_usd" {
  type    = number
  default = 200
}
