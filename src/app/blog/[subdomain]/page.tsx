import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>
}): Promise<Metadata> {
  const { subdomain } = await params
  const supabase = createServiceClient()

  const { data: site } = await supabase
    .from("sites")
    .select("name, description")
    .eq("subdomain", subdomain)
    .single()

  if (!site) return {}

  const url = `https://${subdomain}.inkpop.net`

  return {
    title: site.name,
    description: site.description || `Blog posts from ${site.name}`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: site.name,
      description: site.description || `Blog posts from ${site.name}`,
      url,
      siteName: site.name,
    },
  }
}

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const supabase = createServiceClient()

  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("subdomain", subdomain)
    .single()

  if (!site) notFound()

  const { data: posts } = await supabase
    .from("posts")
    .select("title, slug, meta_description, published_at")
    .eq("site_id", site.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (!posts || posts.length === 0) {
    return <p className="text-muted-foreground">No posts published yet.</p>
  }

  return (
    <div className="space-y-10">
      {posts.map((post) => (
        <article key={post.slug}>
          <Link
            href={`/${post.slug}`}
            className="group"
          >
            <h2 className="font-serif text-xl font-semibold transition-colors group-hover:text-ink-yellow-text">
              {post.title}
            </h2>
            {post.meta_description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {post.meta_description}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(post.published_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </Link>
        </article>
      ))}
    </div>
  )
}
