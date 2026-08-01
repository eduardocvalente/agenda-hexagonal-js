# Produção — perfil profissional.
#
# Decisões e o que cada uma custa:
#  - NAT por AZ: a queda de uma zona não corta a saída de rede da outra (~US$ 64/mês);
#  - WAF com rate limit e regras gerenciadas na borda (~US$ 6/mês + requisições);
#  - mínimo de 2 tasks em AZs distintas: deploy e falha de zona sem indisponibilidade;
#  - Fargate sob demanda, sem Spot: interrupção de capacidade não afeta o usuário;
#  - deletion protection no ALB e logs por 90 dias.

module "stack" {
  source = "../../modules/app-stack"

  project     = var.project
  environment = "production"
  profile     = "profissional"
  region      = var.region

  availability_zones   = var.availability_zones
  vpc_cidr             = "10.20.0.0/16"
  single_nat_gateway   = false
  enable_vpc_endpoints = true

  certificate_arn    = var.certificate_arn
  allowed_cidrs      = ["0.0.0.0/0"]
  access_logs_bucket = var.access_logs_bucket
  waf_rate_limit     = 2000

  image_tag        = var.image_tag
  cpu              = 512
  memory           = 1024
  cpu_architecture = "ARM64"

  desired_count       = 2
  min_capacity        = 2
  max_capacity        = 10
  requests_per_target = 1000

  log_level           = "info"
  log_retention_days  = 90
  bcrypt_rounds       = 12
  rate_limit_max      = 300
  auth_rate_limit_max = 10

  alert_emails                  = var.alert_emails
  error_threshold               = 1
  latency_p95_threshold_seconds = 1.0
  synthetic_check_fqdn          = var.domain_name

  monthly_budget_usd = var.monthly_budget_usd
  cost_center        = "producao"
}

# DNS apontando para o ALB. Alias (não CNAME) permite usar o apex do domínio
# e não é cobrado por consulta.
resource "aws_route53_record" "app" {
  count = var.hosted_zone_id == null ? 0 : 1

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.stack.alb_dns_name
    zone_id                = module.stack.alb_zone_id
    evaluate_target_health = true
  }
}
