"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [jobId, setJobId] = useState<string | null>(null)

  const pollStatus = useCallback(async () => {
    if (!jobId) return

    try {
      const res = await fetch(`/api/agent/status/${jobId}?siteId=${siteId}`)
      const data = await res.json()

      if (data.status === "complete" || data.status === "completed") {
        setRunning(false)
        setJobId(null)
        toast({ title: "Content generated", description: "New draft posts are ready for review." })
        router.refresh()
      }
    } catch {
      // Keep polling
    }
  }, [jobId, siteId, toast, router])

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(pollStatus, 5000)
    return () => clearInterval(interval)
  }, [jobId, pollStatus])

  async function handleRun() {
    setRunning(true)
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      })
      const data = await res.json()

      if (data.jobId) {
        setJobId(data.jobId)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start agent",
          variant: "destructive",
        })
        setRunning(false)
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to start agent",
        variant: "destructive",
      })
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
