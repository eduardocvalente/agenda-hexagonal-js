variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "certificate_arn" {
  type        = string
  description = "Certificado ACM na mesma região do ALB."
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "allowed_cidrs" {
  type        = list(string)
  description = "Origens liberadas na borda. Restrinja em homologação."
  default     = ["0.0.0.0/0"]
}

variable "enable_deletion_protection" {
  type    = bool
  default = true
}

variable "enable_waf" {
  type        = bool
  description = "WAF regional. ~US$ 5/mês + US$ 1 por milhão de requisições."
  default     = true
}

variable "waf_rate_limit" {
  type        = number
  description = "Requisições por IP em janela de 5 minutos antes do bloqueio."
  default     = 2000
}

variable "access_logs_bucket" {
  type        = string
  description = "Bucket S3 para logs de acesso do ALB. null desativa."
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
