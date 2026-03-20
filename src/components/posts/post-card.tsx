import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PostCardProps {
  post: {
    id: string
    title: string
    meta_description: string | null
    status: string
    published_at: string | null
    created_at: string
  }
  siteId: string
}

export function PostCard({ post, siteId }: PostCardProps) {
  return (
    <Link href={`/dashboard/sites/${siteId}/posts/${post.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{post.title}</CardTitle>
            <Badge variant={post.status === "published" ? "default" : "secondary"}>
              {post.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {post.meta_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {post.meta_description}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {post.published_at
              ? `Published ${new Date(post.published_at).toLocaleDateString()}`
              : `Created ${new Date(post.created_at).toLocaleDateString()}`}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
