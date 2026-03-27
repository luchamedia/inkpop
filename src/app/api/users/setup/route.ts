import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(req: Request) {
  return withAuth(async (user) => {
    const { name } = await req.json()

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const sanitized = name.replace(/<[^>]*>/g, "").trim().slice(0, 100)
    if (!sanitized) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const supabase = createServiceClient()
    await supabase
      .from("users")
      .update({ name: sanitized })
      .eq("id", user.id)

    return NextResponse.json({ success: true })
  })
}
