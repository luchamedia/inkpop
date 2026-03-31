import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { addCredits } from "@/lib/credits"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ siteId: string; queueId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId, queueId } = await params
    const supabase = createServiceClient()

    // Verify site ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Load the queue item — only allow canceling queued (not processing) items
    const { data: queueItem } = await supabase
      .from("generation_queue")
      .select("id, status, job_type, idea_id, credits_reserved, user_id")
      .eq("id", queueId)
      .eq("site_id", siteId)
      .single()

    if (!queueItem) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 })
    }

    if (queueItem.status !== "queued") {
      return NextResponse.json(
        { error: "Can only cancel queued items" },
        { status: 400 }
      )
    }

    // Delete the queue row
    await supabase
      .from("generation_queue")
      .delete()
      .eq("id", queueId)

    // Refund the reserved credit
    await addCredits(user.id, queueItem.credits_reserved, queueId, "queue_refund")

    // If it was an idea job, restore the idea to active
    if (queueItem.job_type === "idea" && queueItem.idea_id) {
      await supabase
        .from("post_ideas")
        .update({ status: "active" })
        .eq("id", queueItem.idea_id)
    }

    return NextResponse.json({ success: true })
  })
}
