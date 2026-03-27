"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Lightbulb, Loader2, Sparkles, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface IdeaData {
  id: string
  title: string
  angle: string
  key_learnings: string[]
  meta_description: string | null
  keywords: string[] | null
  slug: string | null
  expires_at: string
  created_at: string
}

interface IdeaListProps {
  siteId: string
  creditBalance: number
}

function daysUntilExpiry(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function IdeaList({ siteId, creditBalance }: IdeaListProps) {
  const [ideas, setIdeas] = useState<IdeaData[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const autoScanned = useRef(false)

  const fetchIdeas = useCallback(async () => {
    setLoadingIdeas(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/ideas`)
      if (res.ok) {
        const data = await res.json()
        setIdeas(data)
      }
    } catch {
      // Silently fail — ideas tab just shows empty
    } finally {
      setLoadingIdeas(false)
    }
  }, [siteId])

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  // Auto-scan when navigated with ?autoScan=1 (from onboarding card)
  useEffect(() => {
    if (searchParams.get("autoScan") === "1" && !autoScanned.current) {
      autoScanned.current = true
      handleScanForIdeas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleGenerateFromIdea(ideaId: string) {
    if (creditBalance <= 0) {
      toast({
        title: "No credits",
        description: "Purchase credits to generate posts.",
        variant: "destructive",
      })
      return
    }

    setGeneratingId(ideaId)
    try {
      const res = await fetch(`/api/sites/${siteId}/ideas/${ideaId}/generate`, {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        toast({
          title: "Generation failed",
          description: data.error || "Something went wrong.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Post generated",
        description: "A new draft has been created from this idea.",
      })

      setIdeas((prev) => prev.filter((i) => i.id !== ideaId))
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate post.",
        variant: "destructive",
      })
    } finally {
      setGeneratingId(null)
    }
  }

  async function handleScanForIdeas() {
    setScanning(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/ideas/scan`, {
        method: "POST",
      })

      if (res.status === 429) {
        toast({
          title: "Limit reached",
          description: "Daily scan limit reached (3/day). Try again tomorrow.",
          variant: "destructive",
        })
        return
      }

      if (!res.ok) {
        const data = await res.json()
        toast({
          title: "Scan failed",
          description: data.error || "Something went wrong.",
          variant: "destructive",
        })
        return
      }

      const data = await res.json()
      toast({
        title: "Ideas generated",
        description: `${data.ideasGenerated} new ideas from ${data.newContentFound} sources. ${data.scansRemaining} scans remaining today.`,
      })

      await fetchIdeas()
    } catch {
      toast({
        title: "Error",
        description: "Failed to scan sources.",
        variant: "destructive",
      })
    } finally {
      setScanning(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {ideas.length} active idea{ideas.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScanForIdeas}
          disabled={scanning}
        >
          {scanning ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          {scanning ? "Generating..." : "Generate Ideas"}
        </Button>
      </div>
      {loadingIdeas ? (
        <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading ideas...</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
          <Lightbulb className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No article ideas yet. Click &quot;Generate Ideas&quot; to scan sources and create ideas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {ideas.map((idea) => {
            const days = daysUntilExpiry(idea.expires_at)
            const isGenerating = generatingId === idea.id

            return (
              <div
                key={idea.id}
                className="flex items-start justify-between py-3 px-3 rounded border border-border"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium">{idea.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {idea.angle}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {days === 0 ? "Expires today" : `${days}d left`}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateFromIdea(idea.id)}
                  disabled={isGenerating || creditBalance <= 0}
                  className="shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {isGenerating ? "Writing..." : "Generate"}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
