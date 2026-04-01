import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { callWorkflow } from "@/lib/ai/agent-client"

interface TopicBrief {
  description: string
  audience: string
  contentGoals: string
}

export const maxDuration = 30

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await req.json()

    // Refine mode: update existing brief based on instruction
    if (body.brief && body.instruction) {
      if (typeof body.instruction !== "string" || body.instruction.length > 500) {
        return NextResponse.json({ error: "Invalid instruction" }, { status: 400 })
      }
      const brief = await callWorkflow<TopicBrief>("refine-topic-brief", {
        description: body.brief.description,
        audience: body.brief.audience,
        contentGoals: body.brief.contentGoals,
        instruction: body.instruction.trim(),
      })
      return NextResponse.json({ brief })
    }

    // Generate mode: create new brief from topic
    const { topic } = body
    if (!topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    const brief = await callWorkflow<TopicBrief>("generate-topic-brief", {
      topic: topic.trim(),
    })
    return NextResponse.json({ brief })
  })
}
