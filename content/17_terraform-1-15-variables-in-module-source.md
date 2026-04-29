+++
title = "Terraform 1.15 Finally Lets You Use Variables in Module Source — And It's About Time"
slug = "terraform-1-15-variables-in-module-source"
date = 2026-04-29

[taxonomies]
tags = ["terraform", "variables", "modules", "infrastructure-as-code", "iac", "hashicorp", "environments", "tfvars"]
+++

If you've been writing Terraform for any team that manages dev, staging, and prod, you already know what I'm about to say. This is a pain that most of us just accepted and moved on with.

<!-- more -->

You want the same module across environments but at different versions. That's it. That's the whole ask. But Terraform said no — `source` and `version` have to be hardcoded strings. No variables, no expressions, nothing. So what do we all end up doing? Copy-paste. The same module block, word for word, sitting in three different folders. The only thing that changes is the version number. And every time someone wants to upgrade, you open five files, make the same edit five times, raise five PRs, and hope you didn't miss one folder somewhere.

We've been doing this for *years*. For a tool that's supposed to reduce manual, repetitive work, this was embarrassingly wrong. Every time a new person joined the team and saw the repo, I'd watch their face as they figured out what was going on. That look of "wait, seriously?" — I've seen it too many times.

<details>
<summary><b>Table of Contents</b></summary>

<!-- vim-markdown-toc GFM -->

- [What Changed in 1.15](#what-changed-in-1-15)
- [One Thing to Watch Out For](#one-thing-to-watch-out-for)
- [Why This Actually Matters](#why-this-actually-matters)
- [Works With Git Sources Too](#works-with-git-sources-too)
- [Final Thoughts](#final-thoughts)
- [References](#references)

<!-- vim-markdown-toc -->

</details>
<br>

# What Changed in 1.15

Terraform 1.15 finally — *finally* — lets you use variables in `source` and `version`. The [PR](https://github.com/hashicorp/terraform/pull/38217) just landed and honestly when I read it I had to go back and read it again just to make sure.

Now you can do this:

```hcl
variable "s3_module_version" {
  type  = string
  const = true
}

module "storage" {
  source  = "github.com/schubergphilis/terraform-aws-mcaf-s3?ref=${var.s3_module_version}"
}
```

And then your tfvars per environment takes care of the rest:

```hcl
# dev.tfvars
s3_module_version = "5.2.0"

# prod.tfvars
s3_module_version = "5.0.1"
```

That's it. One module block, no duplication, no copy-paste, no "wait, did I update all the places?" anxiety at 11pm before a release. The version lives exactly where it should — in the environment config only.

# One Thing to Watch Out For

The variable has to be declared with `const = true`. This is not optional, and if you forget it, `terraform init` will complain very clearly.

```hcl
variable "s3_module_version" {
  type  = string
  const = true
}
```

`const = true` tells Terraform: "this value is known at init time, before you start downloading anything." That's a fair requirement — Terraform needs to resolve the source before it can pull the module, so you can't pass something that's computed at plan or apply time. Once you understand the constraint it makes complete sense. It's the right call, honestly.

# Why This Actually Matters

Our setup was the classic copy-paste situation. Same module block repeated across every environment, only the version number different. Take something like [`terraform-aws-mcaf-s3`](https://github.com/schubergphilis/terraform-aws-mcaf-s3) — one module, three environments, three identical blocks with just the `ref` tag swapped out. We had maybe 10–12 modules like that across three environments, so around 30–36 module blocks that were basically identical. Any version bump was a multi-file, multi-PR exercise. And every time, someone on the team would review the PR and say "this is literally the same change in three places" — yes, we knew, but what else to do?

Now a version upgrade is a one-line change in a tfvars file. You want to test a new version in dev? Change one value, run init, done. Happy with it? Update staging. Then prod. That's a proper progressive rollout — no sprawl, no drift, no "I updated it everywhere except that one folder I missed."

For teams running a lot of shared modules across environments, this is a genuine quality of life improvement. Not a small one either.

# Works With Git Sources Too

This is the part that made me forward the PR link to our team chat immediately. A lot of us source modules from internal git repos, not the public registry. And with `ref=` in the source string, you can now parameterize which tag or branch gets used.

Take [`terraform-aws-mcaf-s3`](https://github.com/schubergphilis/terraform-aws-mcaf-s3) — a real module we use for provisioning S3 buckets across environments. Before 1.15, you'd have a copy of the module block in every environment directory with only the `ref` tag different. Now:

```hcl
variable "s3_module_ref" {
  type  = string
  const = true
}

module "storage" {
  source = "git::https://github.com/schubergphilis/terraform-aws-mcaf-s3.git?ref=${var.s3_module_ref}"

  name = "my-app-data"
}
```

And the version lives in your tfvars:

```hcl
# dev.tfvars — testing the new major version
s3_module_ref = "v3.0.0"

# prod.tfvars — staying on the stable release
s3_module_ref = "v2.0.0"
```

Want to validate v3.0.0 in dev before rolling it to prod? Change one line. No module block duplication, no CI scripts patching `.tf` files, no bash wrappers around `terraform init`. That whole category of hacks — gone. I've seen some truly creative workarounds for this over the years and I'm very happy to never think about them again.

# Final Thoughts

The original feature request for this was opened in [2020](https://github.com/hashicorp/terraform/issues/25587). Six years. Six years of copy-pasting module blocks and explaining to new teammates why things are the way they are. Better late than never, I suppose.

But genuinely — the implementation is clean, the `const` constraint is the right trade-off, and this is one of those features where you read the PR and think: *this should have been there from day one itself.* If you've been putting off upgrading to 1.15, this alone is reason enough. Go check out the [PR](https://github.com/hashicorp/terraform/pull/38217) and the [updated docs](https://developer.hashicorp.com/terraform/language/v1.15.x/block/module).

Your future self — and your teammates — will thank you.

# References

- [Terraform 1.15 PR — Variable in module source](https://github.com/hashicorp/terraform/pull/38217)
- [Original feature request — 2020](https://github.com/hashicorp/terraform/issues/25587)
- [Terraform Module Block Docs](https://developer.hashicorp.com/terraform/language/v1.15.x/block/module)
- [terraform-aws-mcaf-s3 — example module used in this post](https://github.com/schubergphilis/terraform-aws-mcaf-s3)
