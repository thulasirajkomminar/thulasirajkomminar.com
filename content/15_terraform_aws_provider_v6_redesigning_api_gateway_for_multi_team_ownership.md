+++
title = "Terraform AWS Provider v6: Redesigning API Gateway for Multi-Team Ownership"
slug = "terraform_aws_provider_v6_redesigning_api_gateway_for_multi_team_ownership"
date = 2026-03-03

[taxonomies]
tags = ["aws", "api", "gateway", "terraform", "rest-api", "provider", "v6", "refactor", "multi-team", "ownership", "infrastructure-as-code"]
+++

Initially when we first designed our AWS API Gateway setup, the goal was simple, one custom domain, one REST API, and a top-level path-based routing strategy to serve multiple teams. It worked. Teams were onboarded quickly, routing was predictable, and the Terraform was easy to understand. For a while, it was the right call.

Then the HashiCorp AWS Terraform provider v6 landed and with it, the removal of `stage_name` from `aws_api_gateway_deployment`. What started as a migration task turned into something more valuable, a forcing function to rethink our architecture from the ground up and give each team ownership of their own API.

<!-- more -->

<center>
<img src="/images/15_terraform_aws_provider_v6_redesigning_api_gateway_for_multi_team_ownership/1.png" style="width: 100%"/>
</center>
<br>

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [How We Started: One API, One Stage, One Domain](#how-we-started-one-api-one-stage-one-domain)
- [What Changed in Provider v6](#what-changed-in-provider-v6)
- [The New Architecture: Per-Team APIs Behind a Shared Custom Domain](#the-new-architecture-per-team-apis-behind-a-shared-custom-domain)
- [Terraform Implementation](#terraform-implementation)
  - [Platform Team:](#platform-team)
  - [App Teams:](#app-teams)
- [Final Thoughts](#final-thoughts)
  
<!-- vim-markdown-toc -->

</details>
<br>

# How We Started: One API, One Stage, One Domain

Our original setup was deliberately simple. We had a single `aws_api_gateway_rest_api` shared across all teams, deployed to a single stage, and exposed through one custom domain. Teams used top-level path prefixes — `/{team}-{app-name}` to carve out their own routes within the shared API.

```bash
api.example.com
    └── base path: /  →  shared REST API  →  "prd" stage
                               │
                     ┌─────────┼──────────┐
              /team1-app-a   /team1-app-b   /team2-app-a
```

This used to work because the `stage_name` in `aws_api_gateway_deployment` resource implicitly created or updated an API gateway stage. So for example the below configuration would create a deployment, automatically create a stage named `prd` and associate to that deployment(if it didn't already exist) or update the stage to point to the new deployment (if it already existed).

```hcl
resource "aws_api_gateway_deployment" "example" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  stage_name  = "prd"
}
```

# What Changed in Provider v6

In the v6 upgrade, the `stage_name` and related attributes were removed from the `aws_api_gateway_deployment` resource. This means that deployments no longer automatically create or update stages. Instead, stages must be managed explicitly using the `aws_api_gateway_stage` resource.

```hcl
resource "aws_api_gateway_deployment" "example" {
  rest_api_id = aws_api_gateway_rest_api.default.id
}

resource "aws_api_gateway_stage" "prd" {
  stage_name    = "prd"
  rest_api_id   = aws_api_gateway_rest_api.default.id
  deployment_id = aws_api_gateway_deployment.example.id
}
```

This is a nice improvement since stages now have explicit lifecycle management, but it also means that our previous architecture of a single shared API with a single stage is no longer viable. We had to rethink our design to give each team ownership of their own API and stage.

# The New Architecture: Per-Team APIs Behind a Shared Custom Domain

The new refactored design splits ownership along a clean boundary. The platform team owns the custom domain and each app team owns their REST API, deployment, and stage. The connection between them is a `aws_api_gateway_base_path_mapping` resource per team, a thin explicit wire between two independently managed resources.

```bash
api.example.com
    ├── /team1-app-a  →  Team1-App-A REST API  →  "prd" stage
    ├── /team1-app-b  →  Team1-App-B REST API  →  "prd" stage
    └── /team2-app-a  →  Team2-App-A REST API  →  "prd" stage
```

From the outside, the API surface is identical. From the inside, each team is fully isolated.

# Terraform Implementation

## Platform Team:

The platform team provisions the ACM certificate, handles DNS validation, creates the custom domain, and creates the Route 53 alias record. The `domain_name` is then exposed as an output and passed into usecase team modules as a variable.

```hcl
locals {
  api_domain = "api.example.com"

  api_gateway = {
    domain_name = aws_api_gateway_domain_name.default.domain_name
  }
}

# CloudWatch integration role for API Gateway logging
module "cloudwatch_integration_role" {
  source  = "schubergphilis/mcaf-role/aws"
  version = "~> 0.5.3"

  name                  = "ApiGatewayCloudWatchIntegration"
  policy_arns           = ["arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"]
  principal_type        = "Service"
  principal_identifiers = ["apigateway.amazonaws.com"]
  tags                  = var.tags
}

resource "aws_api_gateway_account" "default" {
  cloudwatch_role_arn = module.cloudwatch_integration_role.arn
}

# ACM Certificate with DNS validation
resource "aws_acm_certificate" "api" {
  domain_name       = local.api_domain
  validation_method = "DNS"
  tags              = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  name    = each.value.name
  records = [each.value.record]
  ttl     = 60
  type    = each.value.type
  zone_id = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

# Custom domain — the single shared entry point
resource "aws_api_gateway_domain_name" "default" {
  domain_name              = aws_acm_certificate.api.domain_name
  regional_certificate_arn = aws_acm_certificate_validation.api.certificate_arn
  security_policy          = "TLS_1_2"
  tags                     = var.tags

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# Route 53 alias pointing to the API Gateway regional domain
resource "aws_route53_record" "api" {
  name    = aws_api_gateway_domain_name.default.domain_name
  zone_id = var.route53_zone_id
  type    = "A"

  alias {
    evaluate_target_health = true
    name                   = aws_api_gateway_domain_name.default.regional_domain_name
    zone_id                = aws_api_gateway_domain_name.default.regional_zone_id
  }
}

# Expose domain_name for usecase teams to consume
output "api_domain" {
  value       = local.api_domain
  description = "The API gateway domain name"
}
```

The key output here is `api_domain`. This is the only thing app teams need from the platform, they receive it as a variable input and use it to register their base path mapping.

## App Teams:

Each app team owns their own REST API, resources, methods, integrations, deployment, stage, and base path mapping. The only dependency on the platform team is `var.api_domain`.

```hcl
# Each team's own REST API
resource "aws_api_gateway_rest_api" "default" {
  name = "team1-app-a-api"
  tags = var.tags

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API resources and routing
resource "aws_api_gateway_resource" "root" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  parent_id   = aws_api_gateway_rest_api.default.root_resource_id
  path_part   = "app-name"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  parent_id   = aws_api_gateway_resource.root.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "default" {
  rest_api_id   = aws_api_gateway_rest_api.default.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "default" {
  rest_api_id             = aws_api_gateway_rest_api.default.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.default.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${var.lambda_function_arn}/invocations"
}

# Deployment — triggers on actual resource/method/integration changes only
resource "aws_api_gateway_deployment" "default" {
  rest_api_id = aws_api_gateway_rest_api.default.id
  description = "Deployment of team1-app-a-api"

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.root,
      aws_api_gateway_resource.proxy,
      aws_api_gateway_method.default,
      aws_api_gateway_integration.default,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Stage explicitly managed 
resource "aws_api_gateway_stage" "default" {
  stage_name    = "prd"
  rest_api_id   = aws_api_gateway_rest_api.default.id
  deployment_id = aws_api_gateway_deployment.default.id
  tags          = var.tags
}

# Base path mapping, wires this team's stage to the shared custom domain
resource "aws_api_gateway_base_path_mapping" "default" {
  api_id      = aws_api_gateway_rest_api.default.id
  base_path   = "team1-app-a"
  domain_name = var.api_domain
  stage_name  = aws_api_gateway_stage.default.stage_name
}
```

The base_path `team1-app-a` is what gives each team their unique path on the shared custom domain. A request to `api.example.com/team1-app-a/app-name/...` routes exclusively to this team's REST API and Lambda. The single variable `var.api_domain` is the entire contract between the platform and app teams. Everything else API resources, methods, integrations, deployments, stages are fully owned and independently deployable by each team.

# Final Thoughts

We went into this as a compliance task to update the provider, fix the deprecation, and move on. We came out of it with a meaningfully better architecture that we should have built earlier.
The `stage_name` removal in AWS provider v6 is a small change on the surface, but it draws a clear line that stages should be explicit resources with their own lifecycle. Once you accept that, it is a short step to asking why multiple teams should share that lifecycle at all.
If you are running a multi-team setup on a shared API Gateway and have been putting off this kind of refactor, the v6 migration is as good a reason as any to do it properly.

# References

- [AWS Provider v6 Upgrade Guide](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/guides/version-6-upgrade#resource-aws_api_gateway_deployment)
- [API Gateway HTTP API Mappings](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-mappings.html)
