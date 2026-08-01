output "alb_dns_name" {
  value = module.stack.alb_dns_name
}

output "ecr_repository_url" {
  value = module.stack.ecr_repository_url
}

output "ecs_cluster_name" {
  value = module.stack.ecs_cluster_name
}

output "secret_arns" {
  value = module.stack.secret_arns
}

output "dashboard_url" {
  value = module.stack.dashboard_url
}

output "proximos_passos" {
  value = <<-EOT
    1) Preencha a URI do MongoDB:
       aws secretsmanager put-secret-value --secret-id ${module.stack.secret_arns[1]} --secret-string 'mongodb+srv://...'
    2) Aponte o DNS para ${module.stack.alb_dns_name}
    3) Confirme a inscrição no SNS pelo e-mail recebido
    4) Rode as migrations: npm run migrate
  EOT
}
