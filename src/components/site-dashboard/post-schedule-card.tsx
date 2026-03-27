"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Loader2, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { patchSite } from "@/lib/client-helpers"
import type { SiteData } from "./site-dashboard"

interface PostScheduleCardProps {
  site: SiteData
}

export function PostScheduleCard({ site }: PostScheduleCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [postsPerDay, setPostsPerDay] = useState(site.posts_per_period || 1)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [autoPublish, setAutoPublish] = useState(site.auto_publish)
  const [savingAutoPublish, setSavingAutoPublish] = useState(false)

  const scheduleHasChanges = postsPerDay !== (site.posts_per_period || 1)

  async function handleSaveSchedule() {
    setSavingSchedule(true)
    try {
      const res = await patchSite(site.id, { posting_schedule: "daily", posts_per_period: postsPerDay })
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

  async function handleToggleAutoPublish(checked: boolean) {
    setSavingAutoPublish(true)
    setAutoPublish(checked)
    try {
      const res = await patchSite(site.id, { auto_publish: checked })
      if (res.ok) {
        toast({ title: checked ? "Auto-publish enabled" : "Auto-publish disabled" })
        router.refresh()
      } else {
        setAutoPublish(!checked)
        toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
      }
    } catch {
      setAutoPublish(!checked)
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
    } finally {
      setSavingAutoPublish(false)
    }
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-serif text-sm font-medium">Posting Schedule</h3>
            </div>
            {scheduleHasChanges && (
              <Button size="sm" onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Posts per day</p>
              <span className="text-sm font-medium tabular-nums w-8 text-right">{postsPerDay}</span>
            </div>
            <Slider
              value={[postsPerDay]}
              onValueChange={([v]) => setPostsPerDay(v)}
              min={1}
              max={100}
              step={1}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-sm font-medium">Auto-Publish</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 mr-4">
              <p className="text-sm">Publish automatically</p>
              <p className="text-xs text-muted-foreground">
                AI-generated posts go live without manual review.
              </p>
            </div>
            <Switch
              checked={autoPublish}
              onCheckedChange={handleToggleAutoPublish}
              disabled={savingAutoPublish}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
