import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Link2, ExternalLink } from "lucide-react"

export default async function SiteDetailPage({
  params,
}: {
  params: { siteId: string }
}) {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  const { data: site } = await supabase
    .from("sites")
    .select("*, sources(*)")
    .eq("id", params.siteId)
    .eq("user_id", dbUser.id)
    .single()

  if (!site) redirect("/dashboard/sites")

  const { count: draftCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("status", "draft")

  const { count: publishedCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("status", "published")

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{site.name}</h1>
        <p className="text-muted-foreground">
          {site.subdomain}.inkpop.net
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {site.sources?.length || 0}
            </div>
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <Link href={`/dashboard/sites/${site.id}/sources`}>
                <Link2 className="mr-1 h-3 w-3" />
                Manage sources
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount || 0}</div>
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <Link href={`/dashboard/sites/${site.id}/posts`}>
                <FileText className="mr-1 h-3 w-3" />
                View posts
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Published
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedCount || 0}</div>
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <a
                href={`https://${site.subdomain}.inkpop.net`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                View blog
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
