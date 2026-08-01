variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "assign_public_ip" {
  type        = bool
  description = "true apenas no cenário econômico (subnet pública, sem NAT)."
  default     = false
}

variable "image" {
  type        = string
  description = "Imagem completa. Prefira digest (repo@sha256:...) a tag."
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "cpu" {
  type        = number
  description = "Unidades de CPU (1024 = 1 vCPU)."
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu)
    error_message = "Fargate aceita apenas 256, 512, 1024, 2048 ou 4096."
  }
}

variable "memory" {
  type        = number
  description = "Memória em MiB. Precisa ser compatível com a CPU escolhida."
  default     = 1024
}

variable "cpu_architecture" {
  type        = string
  description = "ARM64 (Graviton) custa ~20% menos que X86_64."
  default     = "ARM64"

  validation {
    condition     = contains(["ARM64", "X86_64"], var.cpu_architecture)
    error_message = "Use ARM64 ou X86_64."
  }
}

variable "environment" {
  type        = map(string)
  description = "Variáveis não sensíveis. Segredo aqui vira segredo vazado no console."
  default     = {}
}

variable "secrets" {
  type        = map(string)
  description = "Mapa NOME_DA_VARIAVEL => ARN do segredo no Secrets Manager."
  default     = {}
}

variable "secret_arns" {
  type        = list(string)
  description = "ARNs liberados na policy da execution role."
  default     = []
}

variable "alb_security_group_id" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "alb_arn_suffix" {
  type    = string
  default = ""
}

variable "target_group_arn_suffix" {
  type    = string
  default = ""
}

variable "desired_count" {
  type        = number
  description = "Tasks iniciais. Menos de 2 significa indisponibilidade durante o deploy."
  default     = 2
}

variable "enable_autoscaling" {
  type    = bool
  default = true
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
  type        = number
  description = "Alvo de requisições por task por minuto. Calibre com teste de carga."
  default     = 1000
}

variable "use_fargate_spot" {
  type    = bool
  default = false
}

variable "capacity_provider_strategy" {
  type = list(object({
    provider = string
    weight   = number
    base     = number
  }))
  description = "Ex.: base 1 em FARGATE + peso em FARGATE_SPOT mantém uma task garantida."
  default = [{
    provider = "FARGATE"
    weight   = 1
    base     = 1
  }]
}

variable "enable_container_insights" {
  type        = bool
  description = "Métricas detalhadas por container. Custa por métrica ingerida."
  default     = true
}

variable "enable_execute_command" {
  type        = bool
  description = "ECS Exec (shell na task). Deixe false em produção e habilite sob demanda."
  default     = false
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
