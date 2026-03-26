import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(req: Request) {
  try {
    const user = await getAuthUser()
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
