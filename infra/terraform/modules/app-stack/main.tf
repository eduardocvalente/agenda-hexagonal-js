# Composição completa da stack. Os diretórios de ambiente só passam valores —
# a topologia fica em um lugar só, evitando que staging e produção divirjam
# silenciosamente ao longo do tempo.

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  name = "${var.project}-${var.environment}"

  tags = merge(var.extra_tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    # Tag de alocação de custo — sem ela o Cost Explorer não separa os ambientes.
    CostCenter = var.cost_center
  })

  # Perfil econômico: sem NAT (US$ ~32/mês), sem WAF (US$ ~5/mês + requisições),
  # sem Container Insights, tasks em subnet pública com IP efêmero.
  economico = var.profile == "economico"
}

module "network" {
  source = "../network"

  name                       = local.name
  region                     = var.region
  cidr_block                 = var.vpc_cidr
  availability_zones         = var.availability_zones
  enable_nat_gateway         = !local.economico
  single_nat_gateway         = var.single_nat_gateway
  assign_public_ip_on_launch = local.economico
  enable_vpc_endpoints       = var.enable_vpc_endpoints
  enable_flow_logs           = !local.economico
  flow_log_retention_days    = var.log_retention_days
  tags                       = local.tags
}

module "ecr" {
  source = "../ecr"

  name             = var.project
  keep_last_images = var.keep_last_images
  tags             = local.tags
}

module "secrets" {
  source = "../secrets"

  name                    = local.name
  recovery_window_in_days = local.economico ? 7 : 30
  tags                    = local.tags
}

module "alb" {
  source = "../alb"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  public_subnet_ids          = module.network.public_subnet_ids
  certificate_arn            = var.certificate_arn
  container_port             = var.container_port
  allowed_cidrs              = var.allowed_cidrs
  enable_deletion_protection = var.environment == "production"
  enable_waf                 = !local.economico
  waf_rate_limit             = var.waf_rate_limit
  access_logs_bucket         = var.access_logs_bucket
  tags                       = local.tags
}

module "ecs" {
  source = "../ecs-service"

  name             = local.name
  vpc_id           = module.network.vpc_id
  subnet_ids       = module.network.app_subnet_ids
  assign_public_ip = local.economico

  image            = "${module.ecr.repository_url}:${var.image_tag}"
  container_port   = var.container_port
  cpu              = var.cpu
  memory           = var.memory
  cpu_architecture = var.cpu_architecture

  environment = {
    NODE_ENV            = "production"
    PORT                = tostring(var.container_port)
    LOG_LEVEL           = var.log_level
    COOKIE_SECURE       = "true"
    COOKIE_SAMESITE     = "lax"
    TRUST_PROXY_HOPS    = "1"
    BCRYPT_ROUNDS       = tostring(var.bcrypt_rounds)
    RATE_LIMIT_MAX      = tostring(var.rate_limit_max)
    AUTH_RATE_LIMIT_MAX = tostring(var.auth_rate_limit_max)
    APP_VERSION         = var.image_tag
  }

  secrets = {
    SESSION_SECRET = module.secrets.session_secret_arn
    MONGODB_URI    = module.secrets.mongodb_uri_arn
  }
  secret_arns = module.secrets.all_arns

  alb_security_group_id   = module.alb.security_group_id
  target_group_arn        = module.alb.target_group_arn
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix

  desired_count       = var.desired_count
  enable_autoscaling  = !local.economico
  min_capacity        = var.min_capacity
  max_capacity        = var.max_capacity
  requests_per_target = var.requests_per_target

  use_fargate_spot           = local.economico
  capacity_provider_strategy = var.capacity_provider_strategy

  enable_container_insights = !local.economico
  enable_execute_command    = var.environment != "production"
  log_retention_days        = var.log_retention_days

  tags = local.tags
}

module "observability" {
  source = "../observability"

  name                          = local.name
  region                        = var.region
  alb_arn_suffix                = module.alb.alb_arn_suffix
  target_group_arn_suffix       = module.alb.target_group_arn_suffix
  cluster_name                  = module.ecs.cluster_name
  service_name                  = module.ecs.service_name
  log_group_name                = module.ecs.log_group_name
  alert_emails                  = var.alert_emails
  error_threshold               = var.error_threshold
  latency_p95_threshold_seconds = var.latency_p95_threshold_seconds
  min_healthy_hosts             = local.economico ? 1 : var.min_capacity
  synthetic_check_fqdn          = var.synthetic_check_fqdn

  tags = local.tags
}

# Teto de gasto com alerta. Não impede a cobrança, mas evita a surpresa
# de fim de mês em um projeto de portfólio.
resource "aws_budgets_budget" "monthly" {
  count = var.monthly_budget_usd == null ? 0 : 1

  name         = "${local.name}-mensal"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Project$${var.project}"]
  }

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value >= 100 ? "FORECASTED" : "ACTUAL"
      subscriber_email_addresses = var.alert_emails
    }
  }
}
