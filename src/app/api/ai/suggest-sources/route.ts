import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { suggestSources } from "@/lib/mindstudio"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    await getAuthUser()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const keywords = typeof body.keywords === "string" ? body.keywords.trim() : ""

    if (!keywords || keywords.length > 200) {
      return NextResponse.json(
        { error: "keywords is required (max 200 characters)" },
        { status: 400 }
      )
    }

    const existingUrls = Array.isArray(body.existingUrls) ? body.existingUrls : []
    const page = typeof body.page === "number" && body.page >= 1 ? body.page : 1

    const suggestions = await suggestSources(keywords, existingUrls, page)

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error("Source suggestion failed:", err)
    return NextResponse.json({ suggestions: [], message: "Could not search at this time" })
  }
}
