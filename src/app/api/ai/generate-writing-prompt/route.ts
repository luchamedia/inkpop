import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { generateWritingPrompt } from "@/lib/mindstudio"
import type { WritingPromptInputs } from "@/lib/writing-prompt"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    await getAuthUser()
    const inputs: WritingPromptInputs = await req.json()

    if (!inputs.companyName || typeof inputs.companyName !== "string") {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 })
    }
    if (!inputs.whatYouDo || typeof inputs.whatYouDo !== "string") {
      return NextResponse.json({ error: "Company description is required" }, { status: 400 })
    }

    const prompt = await generateWritingPrompt(inputs)
    return NextResponse.json({ prompt })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
