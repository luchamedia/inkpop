import { createServiceClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

export default async function BlogLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { subdomain: string }
}) {
  const supabase = createServiceClient()
  const { data: site } = await supabase
    .from("sites")
    .select("name")
    .eq("subdomain", params.subdomain)
    .single()

  if (!site) notFound()

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-12">
        <h1 className="font-serif text-2xl font-semibold">{site.name}</h1>
        <div className="mt-3 h-px bg-border" />
      </header>
      {children}
    </div>
  )
}
