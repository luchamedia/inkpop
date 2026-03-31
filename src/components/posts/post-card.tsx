import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface PostCardProps {
  post: {
    id: string
    title: string
    meta_description: string | null
    status: string
    published_at: string | null
    generated_at: string
  }
  siteId: string
}

export function PostCard({ post, siteId }: PostCardProps) {
  return (
    <Link
      href={`/dashboard/sites/${siteId}/posts/${post.id}`}
      className="flex items-start justify-between py-3 px-2 rounded transition-colors hover:bg-accent group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{post.title}</p>
        {post.meta_description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {post.meta_description}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {post.published_at
            ? `Published ${new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : `Draft \u00b7 ${new Date(post.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </p>
      </div>
      <Badge variant={post.status === "published" ? "published" : "draft"} className="ml-3 shrink-0">
        {post.status}
      </Badge>
    </Link>
  )
}
