import type { MetadataRoute } from "next"
import { createServiceClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient()

  const entries: MetadataRoute.Sitemap = [
    {
      url: "https://inkpop.net",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]

  const { data: posts } = await supabase
    .from("posts")
    .select("slug, published_at, sites!inner(subdomain)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(5000)

  if (posts) {
    for (const post of posts) {
      const subdomain = (post.sites as unknown as { subdomain: string }).subdomain
      entries.push({
        url: `https://${subdomain}.inkpop.net/${post.slug}`,
        lastModified: post.published_at ? new Date(post.published_at) : new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      })
    }
  }

  return entries
}
