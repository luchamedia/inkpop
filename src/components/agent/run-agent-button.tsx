"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface RunAgentButtonProps {
  siteId: string
}

export function RunAgentButton({ siteId }: RunAgentButtonProps) {
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
          description: `${data.postsCreated} new draft post(s) ready for review.`,
        })
        router.refresh()
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

  return (
    <Button onClick={handleRun} disabled={running}>
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
