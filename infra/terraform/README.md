# Infraestrutura como Código

Terraform para AWS: ECS Fargate atrás de ALB, com WAF, Secrets Manager e
CloudWatch. Dois perfis — econômico e profissional.

> **Estado de verificação:** `terraform fmt -check -recursive` e
> `terraform validate` passam nos dois ambientes. `plan` e `apply` **nunca foram
> executados** — exigem credenciais AWS. `validate` confirma sintaxe, tipos e
> referências entre módulos; não confirma que a AWS aceitará os recursos.

---

## Estrutura

```
bootstrap/            S3 + KMS + DynamoDB para o state (roda uma vez por conta)
modules/
  network/            VPC, subnets, NAT, VPC endpoints, flow logs
  ecr/                Repositório com tag imutável e lifecycle
  secrets/            Secrets Manager; SESSION_SECRET gerado, nunca digitado
  alb/                ALB, TLS 1.2+, redirect 80→443, WAF
  ecs-service/        Cluster, task definition, service, autoscaling, IAM
  observability/      6 alarmes, filtro de log, dashboard, check sintético
  app-stack/          Composição de todos os módulos
environments/
  staging/            Perfil econômico
  production/         Perfil profissional
```

A topologia mora em `app-stack`. Os diretórios de ambiente só passam valores —
isso impede que staging e produção divirjam silenciosamente ao longo do tempo.

---

## Uso

### Primeira vez, por conta AWS

```bash
terraform -chdir=bootstrap init
```

```bash
terraform -chdir=bootstrap apply -var project=cadastro-usuario
```

Guarde o output `backend_config`.

### Por ambiente

```bash
cd environments/staging
cp terraform.tfvars.example terraform.tfvars
```

```bash
terraform init -backend-config="bucket=cadastro-usuario-tfstate-<ACCOUNT_ID>"
```

```bash
terraform validate
```

```bash
terraform plan -out=tfplan
```

```bash
terraform apply tfplan
```

Sempre aplique um plano salvo, nunca `apply` direto: garante que o que foi
revisado é exatamente o que será executado.

---

## Perfis

|                     | Econômico                 | Profissional               |
| ------------------- | ------------------------- | -------------------------- |
| Custo estimado      | ~US$ 26/mês               | ~US$ 226/mês               |
| NAT Gateway         | não (subnet pública + SG) | sim, um por AZ             |
| WAF                 | não                       | sim                        |
| Tasks               | 1, em Fargate Spot        | 2+, on-demand, autoscaling |
| Container Insights  | não                       | sim                        |
| Retenção de log     | 7 dias                    | 90 dias                    |
| Deletion protection | não                       | sim                        |

O perfil é escolhido por `profile = "economico" | "profissional"` no
`app-stack`, e a lógica condicional fica em um `local` único — não espalhada.

---

## Custos que surpreendem

| Recurso                  | Cobrança                        | Observação                                                  |
| ------------------------ | ------------------------------- | ----------------------------------------------------------- |
| **NAT Gateway**          | US$ 0,045/h **+** US$ 0,045/GB  | ~US$ 32/mês por unidade **mesmo ocioso**. Em 2 AZs, ~US$ 65 |
| ALB                      | US$ 0,0225/h + LCU              | ~US$ 17/mês de piso                                         |
| VPC endpoint (interface) | US$ 0,01/h cada                 | ~US$ 7/mês cada; compensa acima de ~150 GB/mês pelo NAT     |
| WAF                      | US$ 5/mês + US$ 1/milhão de req | Desligado em staging                                        |
| CloudWatch Logs          | US$ 0,50/GB ingeridos           | Log verboso custa caro; `/healthz` está em nível `silent`   |
| Container Insights       | por métrica                     | Desligado em staging                                        |

O NAT Gateway é a armadilha mais comum: cobra por existir, não por usar. O perfil
econômico o elimina inteiramente.

---

## Segurança

- Nenhuma credencial no código. `SESSION_SECRET` é gerado por
  `random_password` e gravado no Secrets Manager; a URI do MongoDB é preenchida
  fora do Terraform, para não passar pelo state nem pelo pipeline.
- State cifrado com KMS, versionado, com lock em DynamoDB.
- `prevent_destroy` no bucket de state e na tabela de lock.
- Duas roles IAM distintas: `execution` (puxa imagem, lê segredo) e `task`
  (runtime — deliberadamente vazia, a aplicação não chama API da AWS).
- Policy de segredos restrita aos ARNs declarados, nunca `"*"`.
- Security group das tasks aceita **apenas** o security group do ALB.
- ECR com tag imutável: `latest` não pode ser reapontado sob um rollback.
- Checkov roda a cada PR de infraestrutura.

> O state contém segredos em texto puro. Por isso o bucket é cifrado com KMS,
> tem acesso público bloqueado e versionamento. Nunca use state local em
> ambiente compartilhado.

---

## Destruição segura

```bash
terraform plan -destroy
```

Em produção, nesta ordem:

1. desligar `enable_deletion_protection` no ALB e aplicar;
2. **fazer e validar um backup do banco** — destruir a infraestrutura não apaga
   o MongoDB Atlas, mas o caminho até ele desaparece junto;
3. `terraform destroy`;
4. o bucket de state e a tabela de lock só saem por último, e exigem remover
   manualmente o `prevent_destroy`.

---

## Pendências conhecidas

| Item                                                    | Prioridade |
| ------------------------------------------------------- | ---------- |
| Executar `plan` e `apply` contra conta real             | P1         |
| Emitir certificado ACM e validar o DNS                  | P1         |
| Confirmar a assinatura do tópico SNS (chega por e-mail) | P1         |
| Substituir tags de imagem por digests                   | P2         |
| Fixar módulos e providers por hash, não só por range    | P3         |
