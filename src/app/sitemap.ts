import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: "https://inkpop.net",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: posts } = await supabase
      .from("posts")
      .select("slug, published_at, site_id, sites(subdomain)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000)

    if (posts) {
      for (const post of posts) {
        const site = post.sites as unknown as { subdomain: string } | null
        if (!site?.subdomain) continue
        entries.push({
          url: `https://${site.subdomain}.inkpop.net/${post.slug}`,
          lastModified: post.published_at ? new Date(post.published_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.7,
        })
      }
    }
  } catch {
    // Return at least the base URL if DB query fails
  }

  return entries
}
