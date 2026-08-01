# Staging — perfil econômico.
#
# Diferenças conscientes em relação a produção:
#  - sem NAT Gateway (economia de ~US$ 32/mês): as tasks ficam em subnet pública
#    com IP efêmero, protegidas pelo security group que só aceita o ALB;
#  - sem WAF e sem Container Insights;
#  - uma única task, em Fargate Spot;
#  - retenção de log de 7 dias.
#
# A consequência é explícita: staging NÃO tem alta disponibilidade e sofre
# indisponibilidade curta durante o deploy. É um ambiente de validação, não um
# espelho fiel de produção.

module "stack" {
  source = "../../modules/app-stack"

  project     = var.project
  environment = "staging"
  profile     = "economico"
  region      = var.region

  availability_zones = var.availability_zones
  vpc_cidr           = "10.30.0.0/16"
  certificate_arn    = var.certificate_arn

  # Restrinja para os IPs de saída da sua rede — staging não precisa ser público.
  allowed_cidrs = var.allowed_cidrs

  image_tag        = var.image_tag
  cpu              = 256
  memory           = 512
  cpu_architecture = "ARM64"

  desired_count = 1
  min_capacity  = 1
  max_capacity  = 2

  capacity_provider_strategy = [{
    provider = "FARGATE_SPOT"
    weight   = 1
    base     = 0
  }]

  log_level          = "debug"
  log_retention_days = 7
  bcrypt_rounds      = 10

  alert_emails                  = var.alert_emails
  error_threshold               = 5
  latency_p95_threshold_seconds = 2.0

  monthly_budget_usd = 30
  cost_center        = "portfolio-staging"
}
