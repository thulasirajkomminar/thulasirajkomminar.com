import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import sitemap from "@astrojs/sitemap";
import { SITE } from "./src/config";
import vercelStatic from "@astrojs/vercel/static";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    sitemap(),
  ],
  markdown: {
    remarkPlugins: [
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
    ],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      wrap: true,
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  scopedStyleStrategy: "where",
  experimental: {
    contentLayer: true,
  },
  output: "static",
  adapter: vercelStatic({
    webAnalytics: {
      enabled: true,
    },
  }),
  redirects: {
    "/redshift-federated-query-with-aurora-mysql-7de76dda8a1f":
      "/posts/redshift-federated-query-with-aurora-mysql",
    "/lake-formation-cross-account-access-using-terraform-e21279e30531":
      "/posts/lake-formation-cross-account-access-using-terraform",
    "/what-is-hashicorp-terraform-42d419a61cb9":
      "posts/what-is-hashicorp-terraform",
    "/efficient-continuous-deployment-with-github-environments-and-aws-codebuild-9086aef7d913":
      "/posts/efficient-continuous-deployment-with-github-environments-and-aws-codebuild",
    "/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions-c98d057f1a08":
      "/posts/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions",
    "/aws-tip/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions-c98d057f1a08":
      "/posts/effortless-infrastructure-mastering-automated-deployments-with-terraform-and-github-actions",
    "/deploying-and-managing-influxdb-resources-with-terraform-8f1c3c5be8ff":
      "/posts/deploying-and-managing-influxdb-resources-with-terraform",
    "/how-to-bridge-a-terraform-provider-to-pulumi-623db829f52f":
      "/posts/how-to-bridge-a-terraform-provider-to-pulumi",
    "/how-to-write-data-to-influxdb-v3-with-golang-a-step-by-step-tutorial-f32b0d3ea930":
      "/posts/how-to-write-data-to-influxdb-v3-with-golang",
    "/enabling-cross-account-access-for-lake-formation-with-data-filters-using-terraform-ed6e51528c3a":
      "/posts/enabling-cross-account-access-for-aws-lake-formation-with-data-filters-using-terraform",
    "/streamline-sso-access-to-aws-redshift-query-editor-with-okta-and-terraform-3abbecf347c3":
      "/posts/streamline-sso-access-to-aws-redshift-query-editor-with-okta-and-terraform/",
    "/towards-aws/how-to-migrate-amazon-redshift-to-a-different-account-and-region-step-by-step-guide-ba8f56f28911":
      "/posts/how-to-migrate-amazon-redshift-to-a-different-account-and-region",
    "/how-to-migrate-amazon-redshift-to-a-different-account-and-region-step-by-step-guide-ba8f56f28911":
      "/posts/how-to-migrate-amazon-redshift-to-a-different-account-and-region",
    "/towards-aws/data-governance-on-aws-using-datazone-ae88c5460c5d":
      "/posts/data-governance-on-aws-using-datazone",
    "/data-governance-on-aws-using-datazone-ae88c5460c5d":
      "/posts/data-governance-on-aws-using-datazone",
  },
});
