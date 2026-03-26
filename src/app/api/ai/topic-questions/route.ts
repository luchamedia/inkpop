import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { generateTopicBrief, refineTopicBrief } from "@/lib/mindstudio"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    await getAuthUser()
    const body = await req.json()

    // Refine mode: update existing brief based on instruction
    if (body.brief && body.instruction) {
      if (typeof body.instruction !== "string" || body.instruction.length > 500) {
        return NextResponse.json({ error: "Invalid instruction" }, { status: 400 })
      }
      const brief = await refineTopicBrief(body.brief, body.instruction.trim())
      return NextResponse.json({ brief })
    }

    // Generate mode: create new brief from topic
    const { topic } = body
    if (!topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    const brief = await generateTopicBrief(topic.trim())
    return NextResponse.json({ brief })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
