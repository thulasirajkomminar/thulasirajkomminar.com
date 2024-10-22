import type { Site, SocialObjects } from "./types";

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
    name: "Github",
    href: "https://github.com/komminarlabs",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Github",
    href: "https://github.com/thulasirajkomminar",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/komminarlabs/",
    linkTitle: `${SITE.title} on Instagram`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/thulasirajkomminar/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:thulasiraj@komminarlabs.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "Twitter",
    href: "https://x.com/TKomminar",
    linkTitle: `${SITE.title} on Twitter`,
    active: true,
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@thulasirajkomminar",
    linkTitle: `${SITE.title} on TikTok`,
    active: true,
  },
];
