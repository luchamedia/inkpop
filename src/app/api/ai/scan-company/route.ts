import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { callWorkflow } from "@/lib/ai/agent-client"

export const maxDuration = 30

export async function POST(req: Request) {
  return withAuth(async () => {
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    if (parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "Only HTTPS URLs are allowed" },
        { status: 400 }
      )
    }

    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.endsWith(".local")
    ) {
      return NextResponse.json(
        { error: "Internal URLs not allowed" },
        { status: 400 }
      )
    }

    const result = await callWorkflow("scan-company", { url })
    return NextResponse.json(result)
  })
}
