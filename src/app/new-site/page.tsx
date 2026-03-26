import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { NewSiteWizard } from "@/components/new-site/new-site-wizard"

export default async function NewSitePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-3">
        <Link href="/dashboard" className="font-serif text-base font-semibold text-muted-foreground hover:text-foreground transition-colors">
          inkpop
        </Link>
      </div>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <NewSiteWizard />
      </div>
    </div>
  )
}
