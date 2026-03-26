import { redirect } from "next/navigation"

export default async function PostsPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  redirect(`/dashboard/sites/${siteId}?tab=posts`)
}
