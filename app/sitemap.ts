import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const BASE = siteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/contact`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/terms`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
