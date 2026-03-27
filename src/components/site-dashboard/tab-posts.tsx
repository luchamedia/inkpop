"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, FileText, Lightbulb, Loader2, Sparkles, Clock, RefreshCw, Calendar, CalendarDays, Settings2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PostCard } from "@/components/posts/post-card"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { SiteData, PostData } from "./site-dashboard"

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

interface TabPostsProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
}

type Schedule = "daily" | "weekly" | "custom"

const scheduleOptions: { value: Schedule; label: string; icon: typeof Calendar }[] = [
  { value: "daily", label: "Daily", icon: Calendar },
  { value: "weekly", label: "Weekly", icon: CalendarDays },
  { value: "custom", label: "Custom", icon: Settings2 },
]

export function TabPosts({ site, drafts, published, creditBalance }: TabPostsProps) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<IdeaData[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>((site.posting_schedule as Schedule) || "weekly")
  const [postsPerPeriod, setPostsPerPeriod] = useState(site.posts_per_period || 1)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const { toast } = useToast()

  const scheduleHasChanges =
    schedule !== (site.posting_schedule || "weekly") ||
    postsPerPeriod !== (site.posts_per_period || 1)

  async function handleSaveSchedule() {
    setSavingSchedule(true)
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posting_schedule: schedule, posts_per_period: postsPerPeriod }),
      })
      if (res.ok) {
        toast({ title: "Schedule updated" })
        router.refresh()
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error || "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update schedule", variant: "destructive" })
    } finally {
      setSavingSchedule(false)
    }
  }

  const fetchIdeas = useCallback(async () => {
    setLoadingIdeas(true)
    try {
      const res = await fetch(`/api/sites/${site.id}/ideas`)
      if (res.ok) {
        const data = await res.json()
        setIdeas(data)
      }
    } catch {
      // Silently fail — ideas tab just shows empty
    } finally {
      setLoadingIdeas(false)
    }
  }, [site.id])

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

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
      const res = await fetch(`/api/sites/${site.id}/ideas/${ideaId}/generate`, {
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

      // Remove the idea from the list (it's now 'used')
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

  function daysUntilExpiry(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  async function handleScanForIdeas() {
    setScanning(true)
    try {
      const res = await fetch(`/api/sites/${site.id}/ideas/scan`, {
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

      // Refresh the ideas list
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
    <div className="mt-8 space-y-8">
      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-sm font-medium">Posting Schedule</h3>
          </div>
          <div className="space-y-4">
            <div className="grid gap-2 grid-cols-3">
              {scheduleOptions.map((option) => {
                const Icon = option.icon
                return (
                  <Card
                    key={option.value}
                    className={cn(
                      "cursor-pointer transition-colors",
                      schedule === option.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    )}
                    onClick={() => setSchedule(option.value)}
                  >
                    <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{option.label}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm">
                Posts per {schedule === "daily" ? "day" : schedule === "weekly" ? "week" : "period"}
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={postsPerPeriod}
                onChange={(e) => setPostsPerPeriod(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-20"
              />
            </div>
            {scheduleHasChanges && (
              <Button size="sm" onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save schedule
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-serif text-sm font-medium">Content Inbox</h3>
            </div>
            <RunAgentButton siteId={site.id} creditBalance={creditBalance} size="sm" />
          </div>

          <Tabs defaultValue="drafts">
            <TabsList>
              <TabsTrigger value="drafts">
                Drafts ({drafts.length})
              </TabsTrigger>
              <TabsTrigger value="published">
                Published ({published.length})
              </TabsTrigger>
              <TabsTrigger value="ideas">
                <Lightbulb className="h-3 w-3 mr-1" />
                Ideas ({ideas.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="drafts" className="mt-4">
              {drafts.length === 0 ? (
                <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
                  <p className="text-sm text-muted-foreground">
                    No drafts yet. Click &quot;Generate Blog Post&quot; to create content.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {drafts.map((post) => (
                    <PostCard key={post.id} post={post} siteId={site.id} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="published" className="mt-4">
              {published.length === 0 ? (
                <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
                  <p className="text-sm text-muted-foreground">No published posts yet.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {published.map((post) => (
                    <PostCard key={post.id} post={post} siteId={site.id} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ideas" className="mt-4">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
