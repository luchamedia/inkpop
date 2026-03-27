import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/setup", "/new-site"],
      },
    ],
    sitemap: "https://inkpop.net/sitemap.xml",
  }
}
