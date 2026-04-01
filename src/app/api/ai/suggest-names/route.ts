import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { callWorkflow } from "@/lib/ai/agent-client"

export const maxDuration = 30

export async function POST(req: Request) {
  return withAuth(async () => {
    const { topic, topicContext } = await req.json()

    if (!topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    const result = await callWorkflow<{ names: string[] }>("suggest-names", {
      topic,
      topicContext: JSON.stringify(topicContext || []),
    })
    return NextResponse.json({ names: result.names })
  })
}
