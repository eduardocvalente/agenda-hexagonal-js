output "alb_dns_name" {
  description = "Aponte o CNAME/alias do domínio para cá."
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  value = module.alb.alb_zone_id
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecs_service_name" {
  value = module.ecs.service_name
}

output "log_group_name" {
  value = module.ecs.log_group_name
}

output "nat_gateway_ips" {
  description = "IPs de saída para a allow-list do MongoDB Atlas."
  value       = module.network.nat_gateway_ips
}

output "secret_arns" {
  description = "Preencha o segredo mongodb-uri com: aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<uri>'"
  value       = module.secrets.all_arns
}

output "alerts_topic_arn" {
  value = module.observability.sns_topic_arn
}

output "dashboard_url" {
  value = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${module.observability.dashboard_name}"
}
