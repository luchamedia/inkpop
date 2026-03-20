import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Globe, ArrowRight } from "lucide-react"

export default async function SitesPage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  const { data: sites } = await supabase
    .from("sites")
    .select("*, sources(id)")
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Sites</h1>
      </div>

      {!sites || sites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Globe className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No sites yet.</p>
            <Button asChild>
              <Link href="/dashboard/onboarding">Create your first site</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <Link key={site.id} href={`/dashboard/sites/${site.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{site.name}</CardTitle>
                      <CardDescription>
                        {site.subdomain}.inkpop.net
                      </CardDescription>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {site.sources?.length || 0} source
                    {site.sources?.length !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
