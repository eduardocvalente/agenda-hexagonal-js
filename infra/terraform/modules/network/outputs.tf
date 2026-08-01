output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "app_subnet_ids" {
  description = "Subnets onde as tasks rodam: privadas quando há NAT, públicas no cenário econômico."
  value       = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
}

output "nat_gateway_ips" {
  description = "IPs de saída — use para allow-list no MongoDB Atlas."
  value       = aws_eip.nat[*].public_ip
}
