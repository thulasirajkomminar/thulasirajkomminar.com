+++
title = "Deploying and Managing InfluxDB Resources with Terraform"
slug = "deploying-and-managing-influxdb-resources-with-terraform"
date = 2024-02-15
aliases = ["/deploying-and-managing-influxdb-resources-with-terraform-8f1c3c5be8ff", "/posts/deploying-and-managing-influxdb-resources-with-terraform"]

[taxonomies]
tags = ["terraform", "hashicorp", "iac", "infrastructure", "platform", "engineering", "influxdb", "iiot", "manufacturing", "timeseries", "database"]
+++

Terraform is a powerful infrastructure as code tool that automates cloud infrastructure provisioning and management through simple configuration files. If you’re interested in learning more, I’ve written a short blog outlining some key components of Terraform.

<!-- more -->

InfluxDB is a specialized time-series database tailored for efficiently handling large volumes of time-stamped data. In this blog, we’ll explore how to leverage Terraform for provisioning and managing resources within InfluxDB.

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/1.webp" style="width: 120%"/>
</center>
<br>

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Provider Configuration](#provider-configuration)
- [Creating and Managing InfluxDB Resources](#creating-and-managing-influxdb-resources)
  - [Data Sources:](#data-sources)
  - [Resources:](#resources)
  - [Resources](#resources-1)
    - [Organization](#organization)
    - [Bucket](#bucket)
    - [Authorization](#authorization)
  - [Data Sources](#data-sources-1)
- [Additional Resources](#additional-resources)
- [Conclusion](#conclusion)
  
<!-- vim-markdown-toc -->

</details>
<br>

>**Prerequisites:**
>
> - To install Terraform, you can easily follow the steps outlined in this blog post [Install Terraform](https://developer.hashicorp.com/terraform/install).
> - Before diving in, ensure you have a basic understanding of InfluxDB and its components. For installation guidance, refer to this resource [Install InfluxDB](https://docs.influxdata.com/influxdb/v2/install/).

# Provider Configuration

To create and manage InfluxDB resources using Terraform, it utilizes specialized plugins known as providers to interface with InfluxDB. I’ve developed and published a provider for InfluxDB on the [Terraform registry](https://registry.terraform.io/providers/thulasirajkomminar/influxdb/latest), enabling seamless resource creation and management.

Let’s begin by configuring the provider.

- Create a file named `versions.tf` and insert the following code to declare the InfluxDB provider. This allows Terraform to install and utilize the provider. Provider dependencies are specified within a `required_providers` block.

```hcl
terraform {
  required_providers {
    influxdb = {
      source  = "thulasirajkomminar/influxdb"
      version = "1.0.0"
    }
  }
}
```

- Create another file named `main.tf` to initialize the InfluxDB provider. We’ll use a provider block to configure it. You can specify the provider configuration using arguments such as `url` and `token`, or alternatively, utilize environment variables like `INFLUXDB_TOKEN` and `INFLUXDB_URL`.

```bash
export INFLUXDB_TOKEN="influxdb-token"
export INFLUXDB_URL="http://localhost:8086"
```

```hcl
provider "influxdb" {
  token = "influxdb-token"
  url   = "http://localhost:8086"
}
```

# Creating and Managing InfluxDB Resources

The [`thulasirajkomminar/influxdb`](https://registry.terraform.io/providers/thulasirajkomminar/influxdb/latest/docs) provider offers various data sources and resources.

## Data Sources:

- `influxdb_authorization`
- `influxdb_authorizations`
- `influxdb_bucket`
- `influxdb_buckets`
- `influxdb_organization`
- `influxdb_organizations`

## Resources:

- `influxdb_authorization`
- `influxdb_bucket`
- `influxdb_organization`

We’ll begin by creating resources and then utilize data sources to query the created resources. Let’s create two files: `resources.tf` and `datasources.tf`.

## Resources

Resources are the most important element in the Terraform language. Each resource block describes one or more infrastructure objects.

### Organization

An InfluxDB organization is a workspace for a group of users. All dashboards, tasks, buckets, members, etc., belong to an organization. Add the following code to create our organisation.

```hcl
resource "influxdb_organization" "iot" {
  name        = "IoT"
  description = "An IoT organization"
}
```

After running a Terraform plan and verifying everything looks good, let’s proceed with applying the changes.

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/2.webp" style="width: 90%"/>
</center>
<br>

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/3.webp" style="width: 70%"/>
</center>
<br>

### Bucket

An InfluxDB bucket is a named location where time series data is stored. All buckets have a retention period, a duration of time that each data point persists. InfluxDB drops all points with timestamps older than the bucket’s retention period. A bucket belongs to an organization.

Let’s proceed by creating a bucket named `signals` with a retention period of 14 days (1209600 seconds).

```hcl
resource "influxdb_bucket" "signals" {
  org_id           = influxdb_organization.iot.id
  name             = "signals"
  description      = "This is a bucket to store signals"
  retention_period = 1209600
}
```

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/4.webp" style="width: 90%"/>
</center>
<br>

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/5.webp" style="width: 70%"/>
</center>
<br>

### Authorization

Authorizations are InfluxDB Read/Write API tokens that grants read access, write access, or both to specific buckets in an organization.

In the following step, we will generate an authorization that enables both read and write access to the bucket established in the prior phase.

```hcl
resource "influxdb_authorization" "signals_rw" {
  org_id      = influxdb_organization.iot.id
  description = "Read & Write access signals bucket"

  permissions = [{
    action = "read"
    resource = {
      id     = influxdb_bucket.signals.id
      org_id = influxdb_organization.iot.id
      type   = "buckets"
    }
    },
    {
      action = "write"
      resource = {
        id     = influxdb_bucket.signals.id
        org_id = influxdb_organization.iot.id
        type   = "buckets"
      }
  }]
}
```

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/6.webp" style="width: 90%"/>
</center>
<br>

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/7.webp" style="width: 70%"/>
</center>
<br>

## Data Sources

With all the necessary resources created in InfluxDB to manage our time series data, we can now utilize datasources to list all the resources we’ve created.

A data source is accessed via a special kind of resource known as a data resource, declared using a data block.

```hcl
data "influxdb_organization" "iot" {
  name = "IoT"
}

output "iot_organization" {
  value = data.influxdb_organization.iot
}

data "influxdb_bucket" "signals" {
  name = "signals"
}

output "signals_bucket" {
  value = data.influxdb_bucket.signals
}
```

<center>
<img src="/images/deploying-and-managing-influxdb-resources-with-terraform/8.webp" style="width: 90%"/>
</center>
<br>

# Additional Resources

- [https://developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install)
- [https://docs.influxdata.com/influxdb/v2/install/](https://docs.influxdata.com/influxdb/v2/install/)
- [https://registry.terraform.io/providers/thulasirajkomminar/influxdb/latest](https://registry.terraform.io/providers/thulasirajkomminar/influxdb/latest)
- [https://developer.hashicorp.com/terraform/language](https://developer.hashicorp.com/terraform/language)
- [https://github.com/thulasirajkomminar/terraform-provider-influxdb/tree/main/examples](https://github.com/thulasirajkomminar/terraform-provider-influxdb/tree/main/examples)
- [https://thulasirajkomminar.com/what-is-hashicorp-terraform](https://thulasirajkomminar.com/what-is-hashicorp-terraform)

# Conclusion

Now that we’ve explored how to leverage Terraform for creating and managing InfluxDB resources, it’s time to start utilizing it. If you encounter any bugs or issues while using the provider, be sure to [report](https://github.com/thulasirajkomminar/terraform-provider-influxdb/issues) them promptly.
