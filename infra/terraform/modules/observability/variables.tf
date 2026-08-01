variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "target_group_arn_suffix" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "service_name" {
  type = string
}

variable "log_group_name" {
  type = string
}

variable "alert_emails" {
  type        = list(string)
  description = "Destinatários dos alarmes. Cada endereço precisa confirmar a inscrição no SNS."
  default     = []
}

variable "error_threshold" {
  type        = number
  description = "Percentual de 5xx que dispara alarme. Derive do SLO, não de um palpite."
  default     = 1
}

variable "latency_p95_threshold_seconds" {
  type    = number
  default = 1.0
}

variable "min_healthy_hosts" {
  type    = number
  default = 2
}

variable "app_error_threshold" {
  type        = number
  description = "Erros por janela de 5 minutos nos logs antes de alarmar."
  default     = 10
}

variable "synthetic_check_fqdn" {
  type        = string
  description = "Domínio para o health check sintético do Route 53. null desativa."
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
