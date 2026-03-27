import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import sanitizeHtml from "sanitize-html"
import type { Metadata } from "next"

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string; slug: string }>
}): Promise<Metadata> {
  const { subdomain, slug } = await params
  const supabase = createServiceClient()

  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("subdomain", subdomain)
    .single()

  if (!site) return {}

  const { data: post } = await supabase
    .from("posts")
    .select("title, meta_description")
    .eq("site_id", site.id)
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (!post) return {}

  const url = `https://${subdomain}.inkpop.net/${slug}`

  return {
    title: `${post.title} | ${site.name}`,
    description: post.meta_description || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.meta_description || undefined,
      url,
      siteName: site.name,
    },
    twitter: {
      card: "summary",
      title: post.title,
      description: post.meta_description || undefined,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ subdomain: string; slug: string }>
}) {
  const { subdomain, slug } = await params
  const supabase = createServiceClient()

  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("subdomain", subdomain)
    .single()

  if (!site) notFound()

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, slug, body, meta_description, status, published_at")
    .eq("site_id", site.id)
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (!post) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description || undefined,
    datePublished: post.published_at || undefined,
    url: `https://${subdomain}.inkpop.net/${post.slug}`,
    publisher: {
      "@type": "Organization",
      name: "inkpop",
      url: "https://inkpop.net",
    },
  }

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mb-10">
        <h1 className="font-serif text-3xl font-semibold leading-snug sm:text-4xl">
          {post.title}
        </h1>
        {post.published_at && (
          <p className="mt-3 text-sm text-muted-foreground">
            {new Date(post.published_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
        <div className="mt-6 h-px bg-border" />
      </header>
      <div
        className="prose prose-neutral max-w-none prose-headings:font-serif prose-headings:font-semibold"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
      />
    </article>
  )
}
