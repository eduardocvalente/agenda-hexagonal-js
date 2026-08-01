variable "project" {
  type    = string
  default = "cadastro-usuario"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "certificate_arn" {
  type        = string
  description = "ARN do certificado ACM validado para o domínio de staging."
}

variable "allowed_cidrs" {
  type        = list(string)
  description = "IPs liberados na borda. Staging não deveria aceitar 0.0.0.0/0."
  default     = ["0.0.0.0/0"]
}

variable "image_tag" {
  type        = string
  description = "Tag da imagem no ECR. O CD sobrescreve a cada deploy."
  default     = "latest"
}

variable "alert_emails" {
  type    = list(string)
  default = []
}
