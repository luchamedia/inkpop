import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"

export default async function BlogIndex({
  params,
}: {
  params: { subdomain: string }
}) {
  const supabase = createServiceClient()

  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("subdomain", params.subdomain)
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
    <div className="space-y-8">
      {posts.map((post) => (
        <article key={post.slug}>
          <Link
            href={`/blog/${params.subdomain}/${post.slug}`}
            className="group"
          >
            <h2 className="text-xl font-semibold group-hover:underline">
              {post.title}
            </h2>
            {post.meta_description && (
              <p className="mt-1 text-muted-foreground">
                {post.meta_description}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(post.published_at).toLocaleDateString()}
            </p>
          </Link>
        </article>
      ))}
    </div>
  )
}
