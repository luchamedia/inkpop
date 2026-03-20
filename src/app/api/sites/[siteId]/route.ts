import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    const { data: site } = await supabase
      .from("sites")
      .select("*, sources(*)")
      .eq("id", params.siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(site)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
