import type { Site, SocialObjects } from "./types";
import type { GiscusProps } from "@giscus/react";

export const SITE: Site = {
  website: "https://thulasirajkomminar.com/",
  author: "Thulasiraj Komminar",
  profile: "https://thulasirajkomminar.com/",
  desc: "Website for https://thulasirajkomminar.com",
  title: "Thulasiraj Komminar",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 5,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: false,
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "GitHub",
    href: "https://github.com/komminarlabs",
    linkTitle: `Komminar Labs on GitHub (Organization)`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/thulasirajkomminar/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "X",
    href: "https://x.com/TKomminar",
    linkTitle: `${SITE.title} on X`,
    active: true,
  },
  {
    name: "GitHub",
    href: "https://github.com/thulasirajkomminar",
    linkTitle: `${SITE.title} on GitHub (Personal)`,
    active: true,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/komminarlabs/",
    linkTitle: `${SITE.title} on Instagram`,
    active: true,
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@thulasirajkomminar",
    linkTitle: `${SITE.title} on TikTok`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:thulasiraj@komminarlabs.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "BuyMeACoffee",
    href: "https://buymeacoffee.com/thulasirajkomminar",
    linkTitle: `${SITE.title} on Buy Me A Coffee`,
    active: true,
  },
];

export const GISCUS: GiscusProps = {
  repo: "thulasirajkomminar/Discussions",
  repoId: "R_kgDONEuWyw",
  category: "Q&A",
  categoryId: "DIC_kwDONEuWy84Cjn5E",
  mapping: "pathname",
  reactionsEnabled: "0",
  emitMetadata: "0",
  inputPosition: "top",
  lang: "en",
  loading: "lazy",
};
