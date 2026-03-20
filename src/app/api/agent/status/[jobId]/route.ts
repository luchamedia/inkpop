import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { getJobStatus } from "@/lib/mindstudio"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await getAuthUser()
    const data = await getJobStatus(params.jobId)

    // When complete, persist generated posts to the database
    if (data.status === "complete" || data.status === "completed") {
      const url = new URL(req.url)
      const siteId = url.searchParams.get("siteId")

      if (siteId) {
        const supabase = createServiceClient()

        // Verify site ownership
        const { data: site } = await supabase
          .from("sites")
          .select("id")
          .eq("id", siteId)
          .eq("user_id", user.id)
          .single()

        if (site) {
          // Parse posts from MindStudio response
          const posts = data.result?.posts || data.posts || []

          for (const post of posts) {
            await supabase.from("posts").insert({
              site_id: siteId,
              title: post.title,
              slug: post.slug,
              body: post.body,
              meta_description: post.meta_description || null,
              status: "draft",
            })
          }
        }
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
