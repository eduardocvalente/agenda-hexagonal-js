# ADR-0004 — ECS Fargate em vez de Kubernetes

**Data:** 31/07/2026 · **Status:** Aceito

## Contexto

Definir a plataforma de execução do container em produção. Um serviço, um
mantenedor, escala prevista abaixo de 10 instâncias.

## Decisão

**AWS ECS Fargate.**

## Comparação

| Opção                | Custo/mês                    | Complexidade operacional | Veredito                                 |
| -------------------- | ---------------------------- | ------------------------ | ---------------------------------------- |
| Docker Compose em VM | ~US$ 10                      | Baixa                    | Sem HA; patching manual do SO            |
| **ECS Fargate**      | **~US$ 30–90**               | **Média**                | **Escolhido**                            |
| App Runner           | ~US$ 25                      | Muito baixa              | Bom para começar; menos controle de rede |
| EKS                  | +US$ 73 (só o control plane) | Alta                     | Recusado                                 |
| GKE Autopilot / AKS  | Similar ao EKS               | Alta                     | Recusado                                 |

## Por que não Kubernetes

O EKS cobra US$ 73/mês de control plane **antes de qualquer carga**, mais o
custo humano de manter versões do cluster, add-ons (CNI, CoreDNS, ingress
controller) e ciclos de upgrade. Para um serviço, é gastar duas vezes: em
dinheiro e em atenção.

Kubernetes resolve problemas concretos — agendamento heterogêneo, portabilidade
entre nuvens, ecossistema de operadores, multi-tenancy. Nenhum desses problemas
existe aqui. Adotá-lo seria escolher a ferramenta antes do problema.

Os manifests Kubernetes **não foram gerados**. Produzir artefato para uma
arquitetura recusada cria a ilusão de que a opção está pronta e vira dívida no
momento em que divergir do que roda de fato.

## Consequências

**Positivas:** sem servidor para operar; integração nativa com ALB, IAM, Secrets
Manager e CloudWatch; deployment circuit breaker com rollback automático embutido;
Fargate Spot disponível para ambientes não críticos.

**Negativas:** acoplamento à AWS — migrar para outra nuvem exigiria reescrever a
camada de orquestração (a aplicação em si é portável, é um container comum);
menos flexibilidade de agendamento; ecossistema menor que o do Kubernetes.

## Quando revisitar

- Ao chegar a ~5 serviços com necessidades distintas de escala e implantação;
- se surgir requisito real de portabilidade entre provedores;
- se aparecer necessidade de agendamento especializado (GPU, afinidade de nó).
