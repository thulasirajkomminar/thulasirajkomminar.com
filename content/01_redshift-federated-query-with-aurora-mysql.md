+++
title = "Redshift federated query with Aurora(MySQL)"
slug = "redshift-federated-query-with-aurora-mysql"
date = 2021-10-15
aliases = ["/redshift-federated-query-with-aurora-mysql-7de76dda8a1f", "/posts/redshift-federated-query-with-aurora-mysql"]

[taxonomies]
tags = ["aws", "redshift", "federation", "query", "federated-query", "mysql"]
+++

Redshift federated query lets you query and analyse data across multiple operational databases directly. In this blog I have explained how to setup Redshift to query across multiple Aurora instances cross-account.

<!-- more -->

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Architecture](#architecture)
- [AWS Resources Setup](#aws-resources-setup)
- [Steps](#steps)
- [Adding Aurora database as external schema in Redshift](#adding-aurora-database-as-external-schema-in-redshift)
  - [External schema](#external-schema)
  
<!-- vim-markdown-toc -->

</details>
<br>

# Architecture

<center>
<img src="/images/redshift-federated-query-with-aurora-mysql/1.webp" style="width: 100%"/>
</center>
<br>

# AWS Resources Setup

I have explained how to setup AWS resources in the below steps.

>**Prerequisites:**
>
> - VPC Peering should be enabled between the accounts.
> - Amazon Redshift cluster should have a cluster maintenance version that supports federated queries.
> - Amazon Redshift cluster should have enhanced VPC routing enabled.
> - Grant select access to `innodb_index_stats` & `innodb_table_stats` for the aurora user in the aurora cluster.

# Steps

- In Account A create a Customer managed KMS key and add a grant to the Account X’s root user(can also be the Redshift role) with Decrypt & DescribeKey operations.

- In Account A create a secret in the SecretsManager and store the Aurora instance credentials.

- Allow access to the secret for Account X’s root user(can also be the Redshift role) by adding the below resource policy to the secret.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${account-X-id}:root"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*"
    }
  ]
}
```

- In the Aurora cluster security group add inbound rules for Redshift.

- Add a policy to the Redshift role in Account X to allow access to Account A’s KMS key and SecretManger like below.

```json
{
   "Version":"2012-10-17",
   "Statement":[
      {
         "Sid":"",
         "Effect":"Allow",
         "Action":"kms:Decrypt",
         "Resource":[
            "arn:aws:kms:${aws-region}:${account-A-id}:key/*******"
         ]
      },
      {
         "Sid":"",
         "Effect":"Allow",
         "Action":[
            "secretsmanager:ListSecrets",
            "secretsmanager:GetRandomPassword"
         ],
         "Resource":"*"
      },
      {
         "Sid":"",
         "Effect":"Allow",
         "Action":[
            "secretsmanager:ListSecretVersionIds",
            "secretsmanager:GetSecretValue",
            "secretsmanager:GetResourcePolicy",
            "secretsmanager:DescribeSecret"
         ],
         "Resource":[
            "arn:aws:secretsmanager:${aws-region}:${account-A-id}:secret:aurora/*******"
         ]
      }
   ]
}
```

- Allow all outbound traffic in the Redshift cluster security group.

# Adding Aurora database as external schema in Redshift

Once the AWS resources are setup then you can add the Aurora databases as external schemas in Redshift and start querying.

## External schema

```sql
CREATE EXTERNAL SCHEMA redshift_schema_name
FROM MYSQL
DATABASE ‘aurora_schema_name’
URI ‘${aurora_cluster_endpoint}’
IAM_ROLE ‘${redshift_role_arn}’
SECRET_ARN ‘${aurora_secret_arn}’;
```
