+++
title = "From Zero to Fargate: Running Containerized Apps with Aurora on AWS"
slug = "from-zero-to-fargate-running-containerized-apps-with-aurora-on-aws"
date = 2026-03-04

[taxonomies]
tags = ["aws", "ecs", "fargate", "aurora", "serverlessv2", "postgresql", "mcaf", "terraform", "modules", "goalert", "infrastructure-as-code"]
+++

My team needed a simple on-call scheduler to manage who's on call, handle escalations, and send alerts without building something custom. After evaluating options we landed on [GoAlert](https://goalert.me/), an open-source on-call scheduling and alerting platform that does exactly what we needed, without the SaaS price tag.

<!-- more -->

The next challenge was deploying it. Running a containerised workload in production on AWS involves more moving parts than most people anticipate: an ECS cluster, task definitions, IAM roles, a load balancer, DNS, TLS termination, CloudWatch logs, security groups and that's before you've even touched the database. Done by hand, each of these becomes a maintenance burden. Done with the wrong abstractions, they become a security risk.

Instead of writing all that boilerplate Terraform from scratch, we leaned on two battle-tested modules from Schuberg Philis.

- [terraform-aws-mcaf-aurora](https://github.com/schubergphilis/terraform-aws-mcaf-aurora)
- [terraform-aws-mcaf-fargate](https://github.com/schubergphilis/terraform-aws-mcaf-fargate)

These modules are part of the MCAF ecosystem. They encode opinions about security, observability, and reliability that your team would otherwise discover the hard way. You get Aurora Serverless v2 with performance insights and CloudWatch log exports out of the box, Fargate with Container Insights, execute-command support, and a properly wired ALB, all in a handful of module blocks.

By the end of this guide you'll have a fully working GoAlert deployment, with SSM Parameter Store holding all secrets. We'll also cover a bonus section on Okta OIDC authentication and ECS task-kill monitoring via CloudWatch.

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Architecture](#architecture)
- [Terraform Implementation](#terraform-implementation)
  - [Part 1 — The Aurora Database](#part-1-the-aurora-database)
  - [Part 2 — The Fargate Service](#part-2-the-fargate-service)
  - [Bonus — ECS Task Kill Monitoring](#bonus-ecs-task-kill-monitoring)
- [Conclusion](#conclusion)
- [References](#references)
  
<!-- vim-markdown-toc -->

</details>
<br>

# Architecture

Route 53 → ALB (HTTPS) → Fargate (GoAlert) → Aurora Serverless v2 (PostgreSQL 17)

<center>
<img src="/images/16_from-zero-to-fargate-running-containerized-apps-with-aurora-on-aws/1.png" style="width: 100%"/>
</center>
<br>

# Terraform Implementation

>**Prerequisites:**
>
> Before diving in, make sure you have:
>
> - An AWS VPC with public and private subnets
> - A Route 53 hosted zone
> - An S3 bucket for ALB access logs (optional but recommended)
> - A Docker image for GoAlert pushed to ECR (or a public registry)

## Part 1 — The Aurora Database

What is the `mcaf-aurora` module?

The [terraform-aws-mcaf-aurora](https://github.com/schubergphilis/terraform-aws-mcaf-aurora) module provisions an Aurora Serverless v2 cluster with sensible production defaults. Rather than exposing every AWS knob, it surfaces the parameters that actually matter for day-to-day operations and handles the rest internally.

What it provisions:

- RDS Aurora cluster + cluster instances (writer + optional readers)
- DB subnet group (private subnets)
- Security group with configurable ingress rules
- Cluster parameter group + DB parameter group
- Custom cluster endpoint (optional)
- CloudWatch log exports configured on the cluster (RDS manages the log groups)
- Performance Insights & enhanced monitoring IAM role
- Automated backups with configurable retention

For GoAlert we need `PostgreSQL 17` and we use Serverless v2.

```hcl
locals {
  db_name           = "goalert"
  db_admin_username = "GoAlertDbAdmin"
}

resource "random_password" "db_admin_password" {
  length  = 16
  special = false
}

module "goalert_db" {
  source  = "schubergphilis/mcaf-aurora/aws"
  version = "~> 5.0.0"

  name                                = "goalert"
  backup_retention_period             = 15
  cluster_family                      = "aurora-postgresql17"
  database                            = local.db_name
  engine                              = "postgresql"
  engine_mode                         = "serverlessv2"
  engine_version                      = "17.5"
  final_snapshot_identifier           = "goalert-final"
  iam_database_authentication_enabled = false
  instance_count                      = 1
  monitoring_interval                 = 60
  max_capacity                        = 4
  min_capacity                        = 0.5
  manage_master_user                  = false
  master_username                     = local.db_admin_username
  master_password                     = random_password.db_admin_password.result
  performance_insights                = true
  subnet_ids                          = var.vpc_private_subnet_ids
  tags                                = var.tags

  cluster_parameters = [{
    name         = "client_encoding"
    value        = "utf8"
    apply_method = "pending-reboot"
  }]

  enabled_cloudwatch_logs_exports = [
    "iam-db-auth-error",
    "postgresql",
  ]

  security_group_ingress_rules = [
    {
      description = "VPC access"
      cidr_ipv4   = var.vpc_cidr
    }
  ]
}
```

## Part 2 — The Fargate Service

What is the mcaf-fargate module?

The [terraform-aws-mcaf-fargate](https://github.com/schubergphilis/terraform-aws-mcaf-fargate) module provisions everything needed to run a containerised workload on ECS Fargate behind a load balancer. In a single module call you get a production-grade setup that would otherwise take hundreds of lines of Terraform to wire together correctly.

What it provisions:

- ECS cluster + capacity provider + Fargate service + task definition
- Application Load Balancer with HTTP (redirect) and HTTPS listeners
- ACM certificate with Route 53 DNS validation
- Route 53 subdomain record pointing to the ALB
- Security groups for both the ALB and ECS tasks
- CloudWatch log group with configurable retention
- Task execution IAM role (via mcaf-role sub-module) with your supplied policy
- ALB access logging to S3 (optional)
- Container Insights enabled
- ECS Exec support for live debugging (optional)
- Scheduled scaling actions (optional)

```hcl
locals {
  db_url                 = "postgres://${local.db_admin_username}:${random_password.db_admin_password.result}@${module.goalert_db.endpoint}/${local.db_name}"
  initial_admin_username = "goalert-admin"
}

data "aws_iam_policy_document" "default" {
  statement {
    actions = [
      "cloudwatch:DescribeAlarmsForMetric",
      "cloudwatch:DescribeAlarmHistory",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:ListMetrics",
      "cloudwatch:GetMetricData",
      "cloudwatch:GetInsightRuleReport",
      "ec2:DescribeTags",
      "ec2:DescribeInstances",
      "ec2:DescribeRegions",
      "tag:GetResources",
    ]
    resources = ["*"]
  }
}

module "goalert" {
  source  = "schubergphilis/mcaf-fargate/aws"
  version = "~> 3.0.0"

  name                              = "goalert"
  image                             = "goalert/goalert:v0.34.1"
  desired_count                     = 1
  enable_container_insights         = true
  enable_execute_command            = true
  ecs_subnet_ids                    = var.vpc_private_subnet_ids
  load_balancer_subnet_ids          = var.vpc_public_subnet_ids
  load_balancer_deletion_protection = false
  log_retention_days                = 30
  port                              = 8081
  protocol                          = "HTTP"
  readonly_root_filesystem          = false
  role_policy                       = data.aws_iam_policy_document.default.json
  vpc_id                            = var.vpc_id
  tags                              = var.tags

  environment = {
    GOALERT_DB_URL     = local.db_url
    GOALERT_PUBLIC_URL = "https://${module.goalert.fqdn}/"
  }

  load_balancer_logging = {
    s3_bucket_arn = var.lb_access_logs_bucket_arn
    enabled       = true
    prefix        = "${data.aws_region.current.region}-${data.aws_caller_identity.current.account_id}-logs/lb/${var.opco}-goalert"
  }

  subdomain = {
    name    = "goalert"
    zone_id = var.route53_zone_id
  }
}
```

Finally, we store the initial admin credentials in SSM:

> **Note:** In order to login to GoAlert initially you will need an admin user to start with. Afterwards you may enable other authentication methods through the UI. To do this we store these in SSM and use the AWS ECS execute-command feature to run the `add-user` subcommand inside the running container.

```hcl
resource "random_password" "initial_admin_password" {
  length  = 16
  special = false
}

resource "aws_ssm_parameter" "initial_admin_username" {
  name  = "/goalert/admin/username"
  type  = "SecureString"
  value = local.initial_admin_username
  tags  = var.tags
}

resource "aws_ssm_parameter" "initial_admin_password" {
  name  = "/goalert/admin/password"
  type  = "SecureString"
  value = random_password.initial_admin_password.result
  tags  = var.tags
}
```

At this point, a `terraform apply` gives you a publicly accessible GoAlert instance at `https://goalert.your-domain.com`, backed by a serverless Aurora PostgreSQL database, with logs flowing into CloudWatch and access logs landing in S3.

## Bonus — ECS Task Kill Monitoring

An on-call tool going down silently is its own incident. We set up an EventBridge rule to catch **STOPPED ECS** tasks, funnel them into CloudWatch Logs, create a metric filter, and alert via Datadog when a task is killed unexpectedly.

```hcl
resource "aws_cloudwatch_event_rule" "ecs_task_state_change_rule" {
  name        = "${module.goalert.name}-ecs-task-state-change"
  description = "EventBridge rule for ECS Task State Change with STOPPED status"
  tags        = var.tags

  event_pattern = jsonencode({
    "source"      : ["aws.ecs"],
    "detail-type" : ["ECS Task State Change"],
    "detail" : {
      "lastStatus" : ["STOPPED"],
      "clusterArn" : ["arn:aws:ecs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:cluster/${module.goalert.name}"]
    }
  })
}

resource "aws_cloudwatch_log_group" "goalert" {
  name              = "/aws/events/ecs/${module.goalert.name}/task-stopped"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_cloudwatch_log_metric_filter" "goalert_task_killed_filter" {
  name           = "goalert_task_killed_filter"
  log_group_name = aws_cloudwatch_log_group.goalert.name

  metric_transformation {
    name      = "ecs_tasks_killed"
    namespace = "customgoalertmetrics"
    value     = "1"
  }

  pattern = <<PATTERN
{
  ($.source = "aws.ecs" && $.detail.lastStatus = "STOPPED" && $.detail-type = "ECS Task State Change") &&
  ($.detail.stoppedReason = "OutOfMemoryError: Container killed due to memory usage" ||
   $.detail.stoppedReason = "Essential container in task exited" ||
   $.detail.stoppedReason = "Task stopped by user" ||
   $.detail.stopCode = "TaskFailed" ||
   $.detail.stopCode != "ServiceSchedulerInitiated")
}
PATTERN
}

resource "aws_cloudwatch_event_target" "ecs_task_state_change_target" {
  rule = aws_cloudwatch_event_rule.ecs_task_state_change_rule.name
  arn  = aws_cloudwatch_log_group.goalert.arn
}
```

# Conclusion

What started as we need a team on-call scheduler, turned into a great opportunity to demonstrate how much complexity the MCAF modules absorb. With roughly 150 lines of Terraform across the two modules, we have:

- A production Aurora Serverless v2 PostgreSQL cluster with backups, monitoring, and encrypted secrets
- A Fargate service with HTTPS, DNS, Container Insights, ALB access logging, and ECS Exec
- Alerting when the on-call tool itself goes down

# References

- [GoAlert Documentation](https://goalert.me/docs/developer-getting-started/)
