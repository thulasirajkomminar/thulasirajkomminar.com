+++
title = "How to Migrate Amazon Redshift to a Different Account and Region"
slug = "how-to-migrate-amazon-redshift-to-a-different-account-and-region"
date = 2024-07-04

[taxonomies]
categories = ["AWS"]
tags = ["aws", "migration", "snapshot", "cross-region", "redshift"]
+++

Moving Amazon Redshift to a new account and region might seem difficult, but it doesn’t have to be. You might need to follow regulations or reorganize your teams. In this guide, we will show you step by step how to move your Redshift data to a different account and region. After reading this guide, you will know how to do Redshift migrations easily, with minimal downtime and secure data. Let’s start and make your Redshift move simple!

<!-- more -->

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [Architecture](#architecture)
- [Steps](#steps)
  - [Step 1: Configure cross-region snapshot](#step-1-configure-cross-region-snapshot)
  - [Step 2: Create a manual snapshot](#step-2-create-a-manual-snapshot)
  - [Step 3: Grant Access to KMS Key in the Target Account](#step-3-grant-access-to-kms-key-in-the-target-account)
  - [Step 4: Share snapshot](#step-4-share-snapshot)
  - [Step 5: Restoring a Cluster from Snapshot in the Target Account](#step-5-restoring-a-cluster-from-snapshot-in-the-target-account)
- [Conclusion](#conclusion)
- [References](#references)
  
<!-- vim-markdown-toc -->

</details>

<br>

# Architecture

<center>
<img src="/images/how-to-migrate-amazon-redshift-to-a-different-account-and-region/1.webp" style="width: 120%"/>
</center>
<br>

> **Prerequisites**
> 
> For the migration process, choose a maintenance window with minimal write activity, ensuring alignment with the organization’s RTO and RPO requirements.

# Steps

## Step 1: Configure cross-region snapshot

To move the cluster to a different region in a different account, you first need to configure the cross-region snapshot for the cluster in the source account where the cluster resides.

1. Go to your cluster and click Actions.
2. Select Configure cross-region snapshot.
3. In the Destination AWS Region drop-down menu, choose the region where you want to move the cluster in the target account.
4. Click Save.

<center>
<img src="/images/how-to-migrate-amazon-redshift-to-a-different-account-and-region/2.webp" style="width: 50%"/>
</center>
<br>

## Step 2: Create a manual snapshot

To share a cluster snapshot with another AWS account, you need a manual snapshot.

1. Go to your cluster and click Actions.
2. Choose Create Snapshot.
3. Give the snapshot a name and click Create Snapshot.

Since we configured the cross-region snapshot in the previous step, creating a snapshot now will also copy it to the destination region.

<center>
<img src="/images/how-to-migrate-amazon-redshift-to-a-different-account-and-region/3.webp" style="width: 50%"/>
</center>
<br>

## Step 3: Grant Access to KMS Key in the Target Account

When you share an encrypted snapshot, you also need to share the KMS key that was used to encrypt it. To do this, add the following policy to the KMS key. In this policy example, replace `123456789123` with the identifier of the TargetAccount.

```json
{
  "Id": "key-policy-1",
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow use of the key in TargetAccount",
      "Effect": "Allow",
      "Principal": {
        "AWS": ["arn:aws:iam::123456789123:root"]
      },
      "Action": ["kms:Decrypt"],
      "Resource": "*"
    }
  ]
}
```

## Step 4: Share snapshot

Navigate to Snapshots, find the manual snapshot you created, and click on it. Under Snapshot access, click on edit. Enter the TargetAccount ID and click Add account. Once you’re done, click Save. Now, the snapshot will be accessible in the TargetAccount and the destination region..

<center>
<img src="/images/how-to-migrate-amazon-redshift-to-a-different-account-and-region/4.webp" style="width: 50%"/>
</center>
<br>

## Step 5: Restoring a Cluster from Snapshot in the Target Account

Navigate to the TargetAccount and the destination region in Redshift. Under snapshots, you will find the shared snapshot. Click on Restore snapshot and configure options like Nodes, Networking, and more as needed.

# Conclusion

In this guide, we’ve covered the essential steps to migrate Amazon Redshift to a new account and region smoothly. By following these steps carefully, you can ensure minimal downtime and maintain data integrity throughout the migration process. I hope this guide has provided clarity and confidence for your Redshift migration journey!

# References

- [https://docs.aws.amazon.com/redshift/latest/mgmt/managing-snapshots-console.html#snapshot-create](https://docs.aws.amazon.com/redshift/latest/mgmt/managing-snapshots-console.html#snapshot-create)
- [https://docs.aws.amazon.com/redshift/latest/mgmt/managing-snapshots-console.html#snapshot-share](https://docs.aws.amazon.com/redshift/latest/mgmt/managing-snapshots-console.html#snapshot-share)
- [https://docs.aws.amazon.com/redshift/latest/mgmt/managing-snapshots-console.html#snapshot-restore](https://docs.aws.amazon.com/redshift/latest/mgmt/managing-snapshots-console.html#snapshot-restore)
