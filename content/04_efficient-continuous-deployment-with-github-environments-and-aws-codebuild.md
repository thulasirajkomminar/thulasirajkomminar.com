+++
title = "Efficient Continuous Deployment with GitHub Environments and AWS CodeBuild"
slug = "efficient-continuous-deployment-with-github-environments-and-aws-codebuild"
date = 2023-10-30
aliases = ["/efficient-continuous-deployment-with-github-environments-and-aws-codebuild-9086aef7d913", "/posts/efficient-continuous-deployment-with-github-environments-and-aws-codebuild"]

[taxonomies]
#categories = ["AWS", "CICD"]
tags = ["cicd", "github", "actions", "codebuild", "aws", "continuous-deployment", "environments", "deployment"]
+++

In this blog post, I’ll guide you through setting up a Continuous Deployment pipeline using GitHub Actions and environments, focusing on both `development` and `production` stages.
<!-- more -->

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Introduction](#introduction)
- [Initial setup](#initial-setup)
  - [GitHub](#github)
    - [Environments](#environments)
    - [Actions](#actions)
      - [`main`](#main)
      - [`develop`](#develop)
- [AWS](#aws)
  - [IAM](#iam)
    - [OIDC](#oidc)
    - [Create IAM Roles](#create-iam-roles)
      - [GitHub role](#github-role)
      - [CodeBuild Role](#codebuild-role)
  - [CodeBuild](#codebuild)
- [Testing](#testing)
  - [Development](#development)
  - [Production](#production)
- [Wrapping it up](#wrapping-it-up)
  
<!-- vim-markdown-toc -->

</details>
<br>


# Introduction

Continuous Deployment (CD) is a methodology that leverages automation for releasing software updates efficiently. In a standard CD setup, code undergoes automatic building and testing phases prior to its deployment. With GitHub Actions, automating these software workflows becomes seamless. Configure your CD pipeline to initiate whenever there’s a GitHub event, such as a new code push or a pull request. For a comprehensive list of event triggers, [click here](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows).

Environments define common deployment targets such as `production`, `staging`, or `development`. They can be set up with protection rules and associated secrets. When a workflow job references an environment, it only begins after satisfying all the environment’s protection rules. Moreover, a job can only access the secrets linked to an environment after all its deployment protection criteria are met.

# Initial setup

## GitHub

### Environments

First, we’ll establish the `development` and `production` environments and implement deployment protection rules for added security.

Navigate to the repository where you intend to set up the Continuous Deployment (CD). Click on _Settings_, and then select _Environments_ from the sidebar. To add environments, simply click on the _New Environment_ button. As depicted in the image below, I have established two environments.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/1.jpg" style="width: 70%"/>
</center>
<br>

After adding an environment, you’ll be prompted to configure its settings. Let’s dive into that. We’ll start by setting up a protection rule for the `production` environment. As illustrated below, I’ve added a required reviewer to manually approve all deployments headed to `production`.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/2.webp" style="width: 70%"/>
</center>
<br>

Next, we’ll restrict deployments to this environment based on specific branch naming patterns. As demonstrated below, I selected the _Selected branches and tags rule_. Click on _Add deployment branch or tag rule_, and in the subsequent popup, select _Ref type_ as branch and enter `main` for the _Name pattern_.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/3.webp" style="width: 70%"/>
</center>
<br>

To deploy to an AWS account, we require the AWS account ID and region. Therefore, I’ve added these as environment secrets, along with a variable to capture the environment name.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/4.webp" style="width: 70%"/>
</center>
<br>

Likewise, I’ve configured deployment restrictions, environment secrets, and variables for the development environment. However, I omitted the reviewer setup since this environment is solely for development deployments.

### Actions

Now, let’s proceed to create GitHub workflows so that deployments are automatically triggered whenever a commit is made to either the `develop` or `main` branch.

#### `main`

```yaml
name: CD - Production

on:
  push:
    branches:
      - main

permissions:
  id-token: write
  contents: read

jobs:
  codebuild:
    runs-on: ubuntu-latest
    environment: Production
    steps:
      - name: echo
        run: echo 'Deploying to ${{ vars.ENV }}'

      - name: Check out code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNTID }}:role/GitHubTriggerRole
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Run CodeBuild
        uses: aws-actions/aws-codebuild-run-build@v1
        with:
          project-name: CD-CodeBuild
```

#### `develop`

```yaml
name: CD - Development

on:
  push:
    branches:
      - develop

permissions:
  id-token: write
  contents: read

jobs:
  codebuild:
    runs-on: ubuntu-latest
    environment: Development
    steps:
      - name: echo
        run: echo 'Deploying to ${{ vars.ENV }}'

      - name: Check out code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNTID }}:role/GitHubTriggerRole
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Run CodeBuild
        uses: aws-actions/aws-codebuild-run-build@v1
        with:
          project-name: CD-CodeBuild
```

Now, let’s delve into the deployment job’s steps. We’ve included four key actions:

1. **`Echo`:** This step simply prints the name of the environment being deployed.

2. **`Check out code:`** I’m utilizing a GitHub action to retrieve the code from the repository.

3. **`Configure AWS Credentials:`** In this step, I’ve set up an OIDC (OpenID Connect) configuration to enable role assumption, allowing me to make AWS service calls on behalf of the environment. I’ll provide a more detailed explanation of the OIDC setup in the next section, specifically focusing on AWS.

4. **`Run CodeBuild:`** This final step initiates an AWS CodeBuild project and waits for its status, ensuring a smooth and coordinated deployment process.

>**Note:** Ensure that the `environment` name in the actions file corresponds with the GitHub repository’s environment name.

# AWS

Now, let’s explore what needs to be configured on the AWS side.

## IAM

We need to set up two roles: one for GitHub Actions to assume using OIDC, and another for the CodeBuild project to assume.

### OIDC

To begin, log in to the AWS console and navigate to the IAM service. In the sidebar, select _Identity providers_ and click on _Add Provider_. In the _Configure provider_ window, choose the _OpenID Connect_ option.

Here are the specific details you’ll need to fill in:

- For the Provider URL, use `https://token.actions.githubusercontent.com`.
- For the Audience, enter `sts.amazonaws.com`.
- Finally, click _Add Provider_ to complete the setup.

More details on this can be found [here](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services).

### Create IAM Roles

#### GitHub role

Now, within the IAM services, select _Create role_. Opt for the _Custom trust policy_ as the trusted entity type.

Here’s the trust policy text that you should use in the custom trust policy text box:

>**Note:** Replace the GitHub `username/repository` with your own.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${account-id}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:komminarlabs/cd-with-github-actions:*"
        }
      }
    }
  ]
}
```

Name the role as `GitHubTriggerRole`. After creating the role, attach the following policy as an inline policy to grant access for writing logs to CloudWatch and the necessary permissions to trigger a CodeBuild project.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:CreateLogStream",
        "logs:CreateLogGroup"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:eu-central-1:${account-id}:*"
    },
    {
      "Action": [
        "codebuild:UpdateReport",
        "codebuild:StartBuild",
        "codebuild:CreateReportGroup",
        "codebuild:CreateReport",
        "codebuild:BatchPutTestCases",
        "codebuild:BatchPutCodeCoverages",
        "codebuild:BatchGetBuilds"
      ],
      "Effect": "Allow",
      "Resource": "*"
    }
  ]
}
```

#### CodeBuild Role

Next, let’s create a second role for CodeBuild to assume. When you click the _Create role_ button, select _CodeBuild_ as the AWS Service. Attach the existing managed policy `AWSCodeBuildAdminAccess` to this role.

## CodeBuild

Now, head over to the CodeBuild service and select _Create build project_. Specify the project name as _CD-CodeBuild_. In the Source section, choose _GitHub_ from the dropdown and include the Repository URL: `https://github.com/thulasirajkomminar/cd-with-github-actions`

>**Note:** You have the option to authenticate with GitHub using either OAuth or a personal token.

Apply the following Environment settings, and select the role you previously created.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/5.webp" style="width: 70%"/>
</center>
<br>

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/6.webp" style="width: 70%"/>
</center>
<br>

Select _Insert build commands_ under _Buildspec_, then paste the following content. Finally, create the CodeBuild project.

```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      python: 3.11

  build:
    commands:
      - echo "This is a test"
```

# Testing

## Development

Alright, now that we’ve configured everything on both the GitHub and AWS sides, it’s time to put our setup to the test. To do this, I used a `dummy_file.txt` in the GitHub repository for testing purposes.

After pushing a change directly to the `develop` branch, it promptly initiated a deployment to the development environment. The deployment was successful, and you can view the corresponding CodeBuild logs within the Actions.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/7.jpg" style="width: 70%"/>
</center>
<br>

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/8.jpg" style="width: 70%"/>
</center>
<br>

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/9.webp" style="width: 70%"/>
</center>
<br>

## Production

With the successful deployment to the `development` environment, let’s now create a pull request to the `main` branch to trigger the `production` deployment.

As depicted below, the pull request to `main` displays the status of the deployment to `development`. You can enforce this deployment check as mandatory in the branch protection rules for added reliability.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/10.webp" style="width: 70%"/>
</center>
<br>

Now, proceed to merge this pull request. The deployment to the `production` environment will pause and await manual approval, as we’ve included reviewers as a protection rule in the `production` environment.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/11.webp" style="width: 70%"/>
</center>
<br>

Alright, after a thorough manual review of the changes 😊, let’s proceed with approving this deployment. To do so, click on _Review deployments_, select the `production` environment, and then click on _Approve and deploy_.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/12.webp" style="width: 70%"/>
</center>
<br>

With the approval in place, the `production` deployment process is now initiated.

<center>
<img src="/images/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/13.webp" style="width: 70%"/>
</center>
<br>

# Wrapping it up

I hope this blog has provided you with a clear understanding of how to leverage GitHub environments to enhance your continuous deployment process.
