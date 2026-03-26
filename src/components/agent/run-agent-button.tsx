"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Coins } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface RunAgentButtonProps {
  siteId: string
  creditBalance: number
  size?: "default" | "sm" | "lg" | "icon"
}

export function RunAgentButton({ siteId, creditBalance, size }: RunAgentButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [running, setRunning] = useState(false)

  async function handleRun() {
    setRunning(true)
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast({
          title: "Content generated",
          description: `${data.postsCreated} new draft post(s) ready for review. ${data.creditsRemaining} credits remaining.`,
        })
        router.refresh()
      } else if (res.status === 402) {
        toast({
          title: "No credits",
          description: "Buy credits to generate posts.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to generate content",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  if (creditBalance <= 0) {
    return (
      <Button asChild size={size}>
        <Link href="/dashboard/top-up">
          <Coins className="mr-2 h-4 w-4" />
          Buy Credits
        </Link>
      </Button>
    )
  }

  return (
    <Button onClick={handleRun} disabled={running} size={size}>
      {running ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Run Agent
        </>
      )}
    </Button>
  )
}
