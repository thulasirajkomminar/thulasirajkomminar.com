+++
title = "Streamline SSO Access to AWS Redshift Query Editor with Okta and Terraform"
slug = "streamline-sso-access-to-aws-redshift-query-editor-with-okta-and-terraform"
date = 2024-05-18
aliases = ["/streamline-sso-access-to-aws-redshift-query-editor-with-okta-and-terraform-3abbecf347c3", "/posts/streamline-sso-access-to-aws-redshift-query-editor-with-okta-and-terraform/"]

[taxonomies]
categories = ["AWS", "Terraform"]
tags = ["aws", "redshift", "okta", "terraform", "query-editor"]
+++

[AWS Redshift Query Editor v2](https://aws.amazon.com/redshift/query-editor-v2/) is a web-based tool that allows analysts to securely explore, share, and collaborate on data using SQL within a common notebook interface. It simplifies querying data with SQL and visualizing results with charts and graphs in just a few clicks.

<!-- more -->

Integrating Redshift Query Editor v2 with your identity provider (IdP) automatically redirects users to the Query Editor v2 console instead of the Amazon Redshift console. This setup enables seamless access to Amazon Redshift clusters via federated credentials, eliminating the need to manage individual database users and passwords.

In this blog post, we’ll focus on using [Okta](https://www.okta.com/) as the IdP and guide you through configuring your Okta application and AWS IAM permissions. We’ll also demonstrate how to restrict user access to only the Query Editor v2, preventing them from performing administrative functions on the AWS Management Console.

<center>
<img src="/images/streamline-sso-access-to-aws-redshift-query-editor-with-okta-and-terraform/1.webp" style="width: 100%"/>
</center>
<br>

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Create IAM Roles and Permissions](#create-iam-roles-and-permissions)
- [Set Up Okta Application](#set-up-okta-application)
- [Create IAM SAML Provider Role](#create-iam-saml-provider-role)
- [Conclusion](#conclusion)
  
<!-- vim-markdown-toc -->

</details>
<br>

<q>**Prerequisites**
<br><br>
Before you begin, ensure you have the following prerequisites in place:
<br>
<br>**An Okta Account:** You need an active Okta account to serve as your identity provider.
<br>**A Redshift Cluster:** Ensure you have an existing Amazon Redshift cluster set up.
<br>**Configured Query Editor v2:** Make sure Redshift Query Editor v2 is configured. For more details, refer to [Configuring your AWS account](https://docs.aws.amazon.com/redshift/latest/mgmt/query-editor-v2-getting-started.html).
</q>

# Create IAM Roles and Permissions

To enable Okta to access Amazon Redshift Query Editor v2, you need to create two IAM roles. The first role will be used by Okta to access the Redshift Query Editor, and the second role will establish a trust relationship between the IdP (Okta) and AWS. We’ll start by creating the role that Okta uses to access Amazon Redshift Query Editor v2. After setting up the Okta application, we’ll create the trust relationship role using the metadata from the Okta app.

```hcl
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "assume_policy" {
  statement {
    effect = "Allow"
    actions = [
      "sts:AssumeRoleWithSAML",
      "sts:TagSession",
    ]

    principals {
      type        = "Federated"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:saml-provider/OktaRedshiftFederation"]
    }

    condition {
      test     = "StringEquals"
      variable = "SAML:aud"
      values   = ["https://signin.aws.amazon.com/saml"]
    }
  }
}

data "aws_iam_policy_document" "default" {
  statement {
    actions = [
      "redshift:GetClusterCredentials",
      "redshift:CreateClusterUser",
      "redshift:JoinGroup",
    ]
    resources = [
      "arn:aws:redshift:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:cluster:${local.redshift_cluster_id}",
      "arn:aws:redshift:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:${local.redshift_cluster_id}/*",
      "arn:aws:redshift:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbgroup:${local.redshift_cluster_id}/admin",
      "arn:aws:redshift:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbgroup:${local.redshift_cluster_id}/datascientist",
      "arn:aws:redshift:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbname:${local.redshift_cluster_id}/*",
    ]
  }
}

resource "aws_iam_role" "default" {
  name               = "RedshiftQueryEditorFederation"
  assume_role_policy = data.aws_iam_policy_document.assume_policy.json

  tags = {
    environment = "dev"
    stack       = "redshift"
  }
}

resource "aws_iam_role_policy" "default" {
  name   = "RedshiftQueryEditorFederation"
  role   = aws_iam_role.default.id
  policy = data.aws_iam_policy_document.default.json
}

resource "aws_iam_role_policy_attachment" "default" {
  role       = aws_iam_role.default.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRedshiftQueryEditorV2ReadSharing"
}
```

# Set Up Okta Application

With the IAM role for Okta access created, configure the Okta SAML application and assign it to the necessary Okta groups.

```hcl
data "okta_group" "admin" {
  name = "admin"
}

data "okta_group" "datascientist" {
  name = "datascientist"
}

resource "okta_app_saml" "redshift" {
  label               = "Redshift Query Editor v2"
  logo                = "${path.module}/images/redshift.png"
  preconfigured_app   = "amazon_aws"
  saml_version        = "2.0"
  default_relay_state = "https://${data.aws_region.current.name}.console.aws.amazon.com/sqlworkbench/home"

  app_settings_json = jsonencode({
    "awsEnvironmentType" : "aws.amazon",
    "appFilter" : "okta",
    "groupFilter" : "(?{{role}}[a-zA-Z0-9+=,.@\\-_]+)",
    "joinAllRoles" : false,
    "loginURL" : "https://console.aws.amazon.com/ec2/home",
    "roleValuePattern" : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:saml-provider/OktaRedshiftFederation,${aws_iam_role.default.arn}",
    "sessionDuration" : 3600,
    "useGroupMapping" : true,
  })

  attribute_statements {
    type      = "EXPRESSION"
    name      = "https://aws.amazon.com/SAML/Attributes/PrincipalTag:RedshiftDbUser"
    namespace = "urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified"
    values    = ["user.username"]
  }

  attribute_statements {
    type      = "EXPRESSION"
    name      = "https://aws.amazon.com/SAML/Attributes/PrincipalTag:RedshiftDbGroups"
    namespace = "urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified"
    values    = ["String.join(\":\", isMemberOfGroupName(\"datascientist\") ? 'datascientist' : '',isMemberOfGroupName(\"admin\") ? 'admin' : '')"]
  }
}

resource "okta_app_group_assignments" "redshift" {
  app_id = okta_app_saml.redshift.id

  group {
    id = data.okta_group.datascientist.id
  }

  group {
    id = data.okta_group.admin.id
  }
}
```

# Create IAM SAML Provider Role

After setting up the Okta application, create the IAM SAML provider to establish a trust relationship between Okta and AWS using the Okta metadata.

```hcl
resource "aws_iam_saml_provider" "redshift_okta" {
  name                   = "OktaRedshiftFederation"
  saml_metadata_document = okta_app_saml.redshift.metadata

  tags = {
    environment = "dev"
    stack       = "redshift"
  }
}
```

# Conclusion

In this blog post, we demonstrated how to securely federate SSO access to AWS Redshift Query Editor v2 using Okta as the identity provider, leveraging Terraform for seamless infrastructure management. By creating the necessary IAM roles and configuring the Okta SAML application, we established a robust trust relationship between Okta and AWS. This setup not only simplifies user access to Redshift Query Editor v2 but also enhances security by eliminating the need to share database users credentials. With this integration, your teams can efficiently explore, share, and collaborate on data, driving insightful decisions and streamlined operations.
