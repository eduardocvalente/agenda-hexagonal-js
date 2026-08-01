output "alb_dns_name" {
  value = module.stack.alb_dns_name
}

output "ecr_repository_url" {
  value = module.stack.ecr_repository_url
}

output "ecs_cluster_name" {
  value = module.stack.ecs_cluster_name
}

output "ecs_service_name" {
  value = module.stack.ecs_service_name
}

output "log_group_name" {
  value = module.stack.log_group_name
}

output "nat_gateway_ips" {
  description = "Adicione estes IPs à allow-list de rede do MongoDB Atlas."
  value       = module.stack.nat_gateway_ips
}

output "secret_arns" {
  value = module.stack.secret_arns
}

output "alerts_topic_arn" {
  value = module.stack.alerts_topic_arn
}

output "dashboard_url" {
  value = module.stack.dashboard_url
}
