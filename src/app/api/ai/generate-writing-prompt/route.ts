import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { callWorkflow } from "@/lib/ai/agent-client"

export const maxDuration = 60

export async function POST(req: Request) {
  return withAuth(async () => {
    const inputs = await req.json()

    if (!inputs.companyName || typeof inputs.companyName !== "string") {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 })
    }
    if (!inputs.whatYouDo || typeof inputs.whatYouDo !== "string") {
      return NextResponse.json({ error: "Company description is required" }, { status: 400 })
    }

    const prompt = await callWorkflow<string>("generate-writing-prompt", inputs as Record<string, unknown>)
    return NextResponse.json({ prompt })
  })
}
