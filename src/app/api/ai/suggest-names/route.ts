import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { suggestSiteNames } from "@/lib/mindstudio"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    await getAuthUser()
    const { topic, topicContext } = await req.json()

    if (!topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    const names = await suggestSiteNames(topic, topicContext || [])
    return NextResponse.json({ names })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
