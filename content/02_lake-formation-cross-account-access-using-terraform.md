+++
title = "Lake Formation cross-account access using Terraform"
slug = "lake-formation-cross-account-access-using-terraform"
date = 2022-09-15
aliases = ["/lake-formation-cross-account-access-using-terraform-e21279e30531", "/posts/lake-formation-cross-account-access-using-terraform"]

[taxonomies]
categories = ["AWS", "Terraform", "Data Governance"]
tags = ["aws", "cross-account", "data-governance", "data-catalog", "glue", "lakeformation", "redshift", "athena", "s3", "datazone"]
+++

There are two types of cross-account access

1. Storage cross-account access (S3 bucket is in a different account than the Lake Formation account)

2. Consumption cross-account access (Athena, Redshift Spectrum in a different account than the Lake Formation account)

In this guide, we will discuss the consumption cross-account access, enable cross-account Lake Formation access and use a lambda in Account-Target to execute a simple Athena query to access the data from Account-Source.

<!-- more -->

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Architecture](#architecture)
- [Lake Formation setup in Account-Source](#lake-formation-setup-in-account-source)
- [Lake Formation setup in Account-Target](#lake-formation-setup-in-account-target)
- [Use Lambda to execute an Athena query using AWS Wrangler](#use-lambda-to-execute-an-athena-query-using-aws-wrangler)
- [Useful links](#useful-links)
  
<!-- vim-markdown-toc -->

</details>
<br>

# Architecture

<center>
<img src="/images/lake-formation-cross-account-access-using-terraform/1.webp" style="width: 100%"/>
</center>
<br>

<q>**Prerequisites**
<br>
<br>• This guide shows how to enable cross-account access for the accounts that are under the same organization.
<br>• Revoke all Lake Formation permissions from the IAMAllowedPrincipals group for the Data Catalog resource.
<br>• If the cross-account access is for an external account under a different organization then some extra IAM permissions, catalog resource policy, and accepting the RAM share are required.
<br>• Lakeformation cross-region catalog sharing is not supported yet because RAM is a regional service.

# Lake Formation setup in Account-Source

- Setup lake Formation administrators in Account-Source

```hcl
resource "aws_lakeformation_data_lake_settings" "default" {
  admins = [${admin-role-arns}]
}
```

- Create a Lake Formation IAM role and register the S3 location

```hcl
data "aws_iam_policy_document" "lakeformation" {
  statement {
    actions = [
      "s3:ListBucket"
    ]
    resources = [
      "arn:aws:s3:::${data-bucket-name}"
    ]
  }
  statement {
    actions = [
      "s3:GetObject"
    ]
    resources = [
      "arn:aws:s3:::${data-bucket-name}/*"
    ]
  }
}

module "lakeformation_role" {
  source                = "github.com/schubergphilis/terraform-aws-mcaf-role?ref=v0.3.2"
  name                  = "LakeFormation"
  principal_type        = "Service"
  principal_identifiers = ["glue.amazonaws.com", "lakeformation.amazonaws.com"]
  role_policy           = data.aws_iam_policy_document.lakeformation.json
  tags                  = var.tags
  policy_arns = [
    "arn:aws:iam::aws:policy/AWSLakeFormationDataAdmin",
    "arn:aws:iam::aws:policy/AWSLakeFormationCrossAccountManager",
  ]
}

resource "aws_lakeformation_resource" "default" {
  arn      = "arn:aws:s3:::${data-bucket-name}"
  role_arn = module.lakeformation_role.arn
}
```

- Grant the Account-Source’s database and tables to Account-Target

```hcl
resource "aws_lakeformation_permissions" "database" {
  principal                     = ${account-target-id}
  permissions                   = ["DESCRIBE"]
  permissions_with_grant_option = ["DESCRIBE"]
  database {
    name = ${account-source-database-name}
  }
}

resource "aws_lakeformation_permissions" "table" {
  principal                     = ${account-target-id}
  permissions                   = ["SELECT"]
  permissions_with_grant_option = ["SELECT"]
  table {
    database_name = ${account-source-database-name}
    name          = "${account-source-table-name}"
  }
}
```

- Once this is executed you can see the shared database and tables in Account-Target.

# Lake Formation setup in Account-Target

- Setup lake Formation administrators in Account-Target

```hcl
resource "aws_lakeformation_data_lake_settings" "default" {
  admins = [${admin-role-arns}]
}
```

- Create a resource share link in Account-Target. Resource links are a way of accepting resource shares and naming the shares appropriately. You must create a resource link to a shared database for that database to appear in the Amazon Athena and Amazon Redshift Spectrum query editors.

```hcl
resource "aws_glue_catalog_database" "resource_link" {
  name     = "${name}"
  target_database {
    catalog_id    = ${account-source-account-id}
    database_name = "${name}"
  }
}
```

- Once this is executed the resource link will be created and now you can use Athena to execute a query and view the data.

# Use Lambda to execute an Athena query using AWS Wrangler

In this example, we will create a sample lambda and an execution role to query the table using Athena and AWS Wrangler.

- Create a default database where awswrangler can create temp tables

```hcl
resource "aws_glue_catalog_database" "default" {
  name        = "${name}"
  description = "Default catalog used for temp tables"
}
```

- Create an IAM role and policy to access the Lake Formation resources.

```hcl
data "aws_iam_policy_document" "lakeformation_access" {
  statement {
    actions = [
      "athena:Get*",
      "athena:StartQueryExecution",
      "athena:StopQueryExecution"
    ]
    resources = ["*"]
  }
  statement {
    actions = [
      "glue:BatchGetPartition",
      "glue:CreateTable",
      "glue:DeleteTable",
      "glue:Get*"
    ]
    resources = [
      "arn:aws:glue:*:*:catalog",      "arn:aws:glue:*:*:database/${aws_glue_catalog_database.default.name}",
      "arn:aws:glue:*:*:table/${aws_glue_catalog_database.default.name}/temp_table_*",
    ]
  }
  statement {
    actions = [
      "glue:BatchGetPartition",
      "glue:Get*"
    ]
    resources = [
      "arn:aws:glue:*:*:catalog",      "arn:aws:glue:*:*:database/${aws_glue_catalog_database.resource_link.name}",
      "arn:aws:glue:*:*:table/${aws_glue_catalog_database.resource_link.name}/temp_table_*",
    ]
  }
  statement {
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      ${athena-bucket-arn},
      "${athena-bucket-arn}/*"
    ]
  }
  statement {
    actions = ["lakeformation:GetDataAccess"]
    resources = ["*"]
  }
}

module "lambda_role" {
  source                = "github.com/schubergphilis/terraform-aws-mcaf-role?ref=v0.3.2"
  name                  = "Lambda"
  principal_type        = "Service"
  principal_identifiers = ["lambda.amazonaws.com"]
  role_policy           = data.aws_iam_policy_document.lakeformation_access.json
  tags                  = var.tags
}
```

- Grant access to default and shared database & table for the lambda role

```hcl
data "aws_caller_identity" "current" {}

data "aws_caller_identity" "Account_Source" {
  provider = aws.account_source
}

resource "aws_lakeformation_permissions" "default_database" {
  principal                     = module.lambda_role.arn
  permissions                   = ["ALL"]
  permissions_with_grant_option = ["ALL"]
  database {
    name = aws_glue_catalog_database.default.name
  }
}

resource "aws_lakeformation_permissions" "default_table" {
  principal                     = module.lambda_role.arn
  permissions                   = ["ALL"]
  permissions_with_grant_option = ["ALL"]
  table {
    database_name = aws_glue_catalog_database.default.name
    wildcard      = true
  }
}

resource "aws_lakeformation_permissions" "shared_database" {
  principal                     = module.lambda_role.arn
  permissions                   = ["DESCRIBE"]
  permissions_with_grant_option = ["DESCRIBE"]
  database {
    name = ${resource-link-name}
  }
}

resource "aws_lakeformation_permissions" "shared_table" {
  catalog_id                    = data.aws_caller_identity.current.account_id
  principal                     = module.lambda_role.arn
  permissions                   = ["SELECT"]
  permissions_with_grant_option = ["SELECT"]
table {
    catalog_id    = data.aws_caller_identity.Account_Source.account_id
    database_name = ${shared-database-name}
    name          = ${shared-table-name}
  }
}
```

- Once this is executed create a sample lambda function and execute the sample code.

```python
import awswrangler as wr
def lambda_handler(event, context):
    try:
        sql = "SELECT * FROM ${table} limit 10"
        df = wr.athena.read_sql_query(
            sql=sql, database="${resource-link-database}", ctas_database_name="${default-database}"
        )
        print(df)
    except Exception as e:
        print(e)
        raise e
```

# Useful links

- [https://aws.amazon.com/premiumsupport/knowledge-center/glue-lake-formation-cross-account/](https://aws.amazon.com/premiumsupport/knowledge-center/glue-lake-formation-cross-account/)
- [https://docs.aws.amazon.com/lake-formation/latest/dg/cross-account-read-data.html](https://docs.aws.amazon.com/lake-formation/latest/dg/cross-account-read-data.html)
- [https://docs.aws.amazon.com/lake-formation/latest/dg/access-control-underlying-data.html](https://docs.aws.amazon.com/lake-formation/latest/dg/access-control-underlying-data.html)
- [https://docs.amazonaws.cn/en_us/lake-formation/latest/dg/hybrid-cross-account.html](https://docs.amazonaws.cn/en_us/lake-formation/latest/dg/hybrid-cross-account.html)
- [https://docs.aws.amazon.com/lake-formation/latest/dg/cross-account-permissions.html](https://docs.aws.amazon.com/lake-formation/latest/dg/cross-account-permissions.html)
