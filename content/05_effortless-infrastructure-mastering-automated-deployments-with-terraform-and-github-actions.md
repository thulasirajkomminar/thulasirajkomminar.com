+++
title = "Effortless Infrastructure - Mastering Automated Deployments with Terraform and GitHub Actions"
slug = "effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions"
date = 2024-01-26
aliases = ["/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions-c98d057f1a08", "/posts/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions", "/aws-tip/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions-c98d057f1a08"]

[taxonomies]
tags = ["cicd", "github", "actions", "codebuild", "aws", "continuous-deployment", "environments", "deployment", "aws", "terraform"]
+++

In the earlier [blog post](https://www.thulasirajkomminar.com/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/), I showcased the steps to achieve continuous deployment using GitHub Actions and AWS CodeBuild specifically for code deployment. Expanding on those principles, let’s delve into the next phase of our workflow — incorporating infrastructure deployment through Terraform.

<!-- more -->

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/1.webp" style="width: 70%"/>
</center>
<br>

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Setup Terraform Cloud Workspace](#setup-terraform-cloud-workspace)
  - [Step 1:](#step-1)
  - [Step 2:](#step-2)
  - [Step 3:](#step-3)
  - [Step 4:](#step-4)
- [Set up a GitHub repository](#set-up-a-github-repository)
  - [Step 1:](#step-1-1)
  - [Step 2:](#step-2-1)
    - [`Plan`](#plan)
    - [`Apply`](#apply)
- [Demo](#demo)
  - [Pull Request](#pull-request)
  - [Merge](#merge)
- [Wrapping it up](#wrapping-it-up)
  
<!-- vim-markdown-toc -->

</details>
<br>

# Setup Terraform Cloud Workspace

The GitHub Action you’re about to set up will seamlessly integrate with Terraform Cloud, allowing you to efficiently plan and apply your configurations. Before configuring the Actions workflow, ensure you’ve taken the necessary steps: creating a workspace, incorporating your AWS credentials into your Terraform Cloud workspace, and generating a Terraform Cloud user API token.

## Step 1:

To kickstart the process, initiate a new Terraform Cloud workspace. Navigate to the Projects & Workspaces page, click on _New Workspace_, and opt for the _API-Driven Workflow_ option.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/2.webp" style="width: 70%"/>
</center>
<br>

## Step 2:

Provide a name for the workspace and proceed by clicking on the _Create_ button.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/3.webp" style="width: 70%"/>
</center>
<br>

## Step 3:

Now, it’s time to include your AWS IAM credentials as environmental variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION`) within the workspace. Navigate to the _Variables_ section in the workspace, click on _Add Variable_, and select _Environment variable_ as the variable category. Terraform Cloud will use these credentials to authenticate to AWS.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/4.webp" style="width: 70%"/>
</center>
<br>

## Step 4:

Now, let’s generate an API token to enable authentication for the Actions workflow in Terraform Cloud. Head to the Tokens page within your Terraform Cloud User Settings. Click on Create an _API token_, provide a description, and then click _Generate token_.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/5.webp" style="width: 70%"/>
</center>
<br>

# Set up a GitHub repository

Establish a GitHub repository dedicated to housing your infrastructure configuration code and the associated GitHub Actions workflow.

## Step 1:

Once you’ve created the repository, proceed to the Settings page. Access the _Secrets and Variables_ menu, specifically selecting Actions. Click _New Repository Secret_ and input the Terraform API token generated in the previous step.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/6.jpg" style="width: 100%"/>
</center>
<br>

## Step 2:

Now, it’s time to incorporate the following GitHub Actions workflow.

### `Plan`

```yaml
name: "Terraform"

on:
  pull_request:
    branches:
      - main
    paths:
      - terraform/**
      - modules/**

env:
  TF_API_TOKEN: ${{ secrets.TF_API_TOKEN }}
  TF_WORKING_DIRECTORY: terraform/

permissions:
  contents: read
  pull-requests: write

jobs:
  terraform:
    name: "Plan"
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ env.TF_WORKING_DIRECTORY }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          cli_config_credentials_token: ${{ env.TF_API_TOKEN }}

      - name: Terraform Init
        id: init
        run: |
          git config --global url."https://oauth2:${{ secrets.GITHUB_TOKEN }}@github.com".insteadOf ssh://git@github.com
          terraform init

      - name: Terraform Validate
        id: validate
        run: terraform validate -no-color

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color
        continue-on-error: true

      - name: Update PR
        uses: actions/github-script@v7
        env:
          PLAN_OUTPUT: ${{ steps.plan.outputs.stdout }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            // 1. Retrieve existing bot comments for the PR
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            })
            const botComment = comments.find(comment => {
              return comment.user.type === 'Bot' && comment.body.includes('Terraform Plan Results')
            })

            // 2. Prepare format of the comment
            const output = `### Terraform Plan Results 🚀
            #### Terraform Initialization ⚙️\`${{ steps.init.outcome }}\`
            #### Terraform Validation 🤖\`${{ steps.validate.outcome }}\`
            <details><summary>Validation Output</summary>

            \`\`\`\n
            ${{ steps.validate.outputs.stdout }}
            \`\`\`

            </details>

            #### Terraform Plan 📖\`${{ steps.plan.outcome }}\`

            <details><summary>Show Plan</summary>

            \`\`\`\n
            ${process.env.PLAN_OUTPUT}
            \`\`\`

            </details>

            *Pusher: @${{ github.actor }}, Action: \`${{ github.event_name }}\`, Working Directory: \`${{ env.TF_WORKING_DIRECTORY }}\`, Workflow: \`${{ github.workflow }}\`*`;

            // 3. If we have a comment, update it, otherwise create a new one
            if (botComment) {
              github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: botComment.id,
                body: output
              })
            } else {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: output
              })
            }
```

Now, let’s delve into the deployment job’s steps. We’ve included four key actions:

1. **Check out code:** I’m utilizing a GitHub action to retrieve the code from the repository.

2. **Terraform Init:** This step utilizes the `hashicorp/setup-terraform@v3` action to initialize Terraform. I included the Git configuration in case the code involves private GitHub modules.

3. **Terraform Validate:** This step is dedicated to validating the Terraform code.

4. **Terraform Plan:** This step is employed to execute the Terraform plan.

5. **Update PR:** This step leverages the `actions/github-script@v7` action to update the Pull Request with the results from the preceding actions.

### `Apply`

```yaml
name: "Terraform"

on:
  push:
    branches:
      - main
    paths:
      - terraform/**
      - modules/**

env:
  TF_API_TOKEN: ${{ secrets.TF_API_TOKEN }}
  TF_WORKING_DIRECTORY: terraform/

permissions:
  contents: read

jobs:
  terraform:
    name: "Apply"
    runs-on: ubuntu-latest
    environment: prd
    defaults:
      run:
        working-directory: ${{ env.TF_WORKING_DIRECTORY }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          cli_config_credentials_token: ${{ env.TF_API_TOKEN }}

      - name: Terraform Init
        id: init
        run: |
          git config --global url."https://oauth2:${{ secrets.GITHUB_TOKEN }}@github.com".insteadOf ssh://git@github.com
          terraform init

      - name: Terraform Apply
        id: apply
        run: terraform apply -auto-approve -no-color
```

Let’s delve into the steps outlined in this workflow.

1. **Check out code:** I’m utilizing a GitHub action to retrieve the code from the repository.

2. **Terraform Init:** This step utilizes the `hashicorp/setup-terraform@v3` action to initialize Terraform. Additionally, I’ve included Git configuration in case the code incorporates private GitHub modules. Executing this action is a prerequisite before proceeding with the apply step.

3. **Terraform Apply:** This step applies the Terraform infrastructure configuration to AWS.

# Demo

Now, let’s put our setup into action. For demonstration purposes, I’ve included Terraform configuration files to create an S3 bucket.

## Pull Request

After incorporating the Terraform configuration files into a `feature` branch, let’s create a pull request to the `main` branch. This action will initiate GitHub Actions to execute Validation and Plan, with the results seamlessly added back to the pull request for convenient review.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/7.webp" style="width: 70%"/>
</center>
<br>

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/8.webp" style="width: 70%"/>
</center>
<br>

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/9.jpg" style="width: 70%"/>
</center>
<br>

## Merge

After a thorough review of the pull request and ensuring the Terraform plan results meet expectations, proceed to merge the pull request. This will trigger the Terraform apply process.

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/10.jpg" style="width: 70%"/>
</center>
<br>

<center>
<img src="/images/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions/11.webp" style="width: 70%"/>
</center>
<br>

# Wrapping it up

In conclusion, we’ve explored the powerful capabilities of GitHub Actions in automating Terraform infrastructure deployments. If you’ve already followed my [previous blog](https://www.thulasirajkomminar.com/efficient-continuous-deployment-with-github-environments-and-aws-codebuild/) on code deployment using GitHub Actions, you can seamlessly combine these processes to achieve sequential infrastructure deployment and code deployment, streamlining your development workflow.
