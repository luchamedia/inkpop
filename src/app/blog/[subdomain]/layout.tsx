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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-12 border-b pb-4">
        <h1 className="text-2xl font-bold">{site.name}</h1>
      </header>
      {children}
    </div>
  )
}
