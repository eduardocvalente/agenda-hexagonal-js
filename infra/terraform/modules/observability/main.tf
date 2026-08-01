terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

# Alarme sem destino é decoração. O tópico SNS é o contrato de acionamento.
resource "aws_sns_topic" "alerts" {
  name              = "${var.name}-alerts"
  kms_master_key_id = "alias/aws/sns"
  tags              = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alert_emails)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# --- Quatro sinais dourados ---

# Erros: 5xx da aplicação. Só conta target_5xx (elb_5xx cobre falha do próprio ALB).
resource "aws_cloudwatch_metric_alarm" "http_5xx" {
  alarm_name          = "${var.name}-http-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = var.error_threshold
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "taxa_erro"
    expression  = "IF(requisicoes > 10, 100 * erros / requisicoes, 0)"
    label       = "Percentual de 5xx"
    return_data = true
  }

  metric_query {
    id = "erros"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "requisicoes"
    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  alarm_description = "Taxa de 5xx acima de ${var.error_threshold}% — consome error budget do SLO de disponibilidade."
  alarm_actions     = [aws_sns_topic.alerts.arn]
  ok_actions        = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Latência: p95, não média. A média esconde a cauda que o usuário sente.
resource "aws_cloudwatch_metric_alarm" "latency_p95" {
  alarm_name          = "${var.name}-latencia-p95"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.latency_p95_threshold_seconds
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }

  alarm_description = "p95 acima de ${var.latency_p95_threshold_seconds}s."
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Saturação: tasks saudáveis. Zero = indisponibilidade total.
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.name}-alvos-saudaveis"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = var.min_healthy_hosts
  treat_missing_data  = "breaching"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_description = "Menos de ${var.min_healthy_hosts} task(s) saudável(is) atrás do ALB."
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.name}-cpu-alta"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  treat_missing_data  = "notBreaching"
  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  alarm_description = "CPU sustentada acima de 85% — autoscaling pode ter atingido o teto."
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  alarm_name          = "${var.name}-memoria-alta"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 85
  treat_missing_data  = "notBreaching"
  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  alarm_description = "Memória sustentada acima de 85% — investigue vazamento antes de aumentar o limite."
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# --- Logs: erros da aplicação viram métrica ---
# O logger emite JSON; o filtro extrai o nível diretamente do campo estruturado.
resource "aws_cloudwatch_log_metric_filter" "app_errors" {
  name           = "${var.name}-erros-aplicacao"
  log_group_name = var.log_group_name
  pattern        = "{ $.level = \"error\" || $.level = \"fatal\" }"

  metric_transformation {
    name          = "ApplicationErrors"
    namespace     = "CadastroUsuario/${var.name}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "app_errors" {
  alarm_name          = "${var.name}-erros-aplicacao"
  namespace           = "CadastroUsuario/${var.name}"
  metric_name         = "ApplicationErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.app_error_threshold
  treat_missing_data  = "notBreaching"

  alarm_description = "Volume anormal de erros nos logs da aplicação."
  alarm_actions     = [aws_sns_topic.alerts.arn]
  tags              = var.tags
}

# Monitoramento sintético: valida a experiência real de ponta a ponta,
# inclusive TLS e DNS, que as métricas do ALB não cobrem.
resource "aws_route53_health_check" "synthetic" {
  count = var.synthetic_check_fqdn == null ? 0 : 1

  fqdn              = var.synthetic_check_fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = "/readyz"
  failure_threshold = 3
  request_interval  = 30
  measure_latency   = true

  tags = merge(var.tags, { Name = "${var.name}-synthetic" })
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = var.name

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title  = "Tráfego e erros"
          region = var.region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum" }],
            [".", "HTTPCode_Target_4XX_Count", ".", ".", { stat = "Sum" }]
          ]
          period = 300
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "Latência (p50 / p95 / p99)"
          region = var.region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p50" }],
            ["...", { stat = "p95" }],
            ["...", { stat = "p99" }]
          ]
          period = 300
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "Saturação (CPU / memória / tasks)"
          region = var.region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.cluster_name, "ServiceName", var.service_name],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix]
          ]
          period = 60
        }
      },
      {
        type = "log", x = 12, y = 6, width = 12, height = 6
        properties = {
          title  = "Erros recentes"
          region = var.region
          query  = "SOURCE '${var.log_group_name}' | fields @timestamp, level, msg, requestId, event | filter level in ['error','fatal'] | sort @timestamp desc | limit 50"
        }
      }
    ]
  })
}
