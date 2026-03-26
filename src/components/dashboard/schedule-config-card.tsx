"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Calendar, CalendarDays, Settings2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Schedule = "daily" | "weekly" | "custom"

interface ScheduleConfigCardProps {
  siteId: string
  currentSchedule: string
  currentPostsPerPeriod: number
}

const scheduleOptions: {
  value: Schedule
  label: string
  description: string
  icon: typeof Calendar
}[] = [
  { value: "daily", label: "Daily", description: "Post every day", icon: Calendar },
  { value: "weekly", label: "Weekly", description: "Post every week", icon: CalendarDays },
  { value: "custom", label: "Custom", description: "Set your own pace", icon: Settings2 },
]

export function ScheduleConfigCard({
  siteId,
  currentSchedule,
  currentPostsPerPeriod,
}: ScheduleConfigCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [schedule, setSchedule] = useState<Schedule>(
    (currentSchedule as Schedule) || "weekly"
  )
  const [postsPerPeriod, setPostsPerPeriod] = useState(currentPostsPerPeriod || 1)
  const [saving, setSaving] = useState(false)

  const hasChanges = schedule !== currentSchedule || postsPerPeriod !== currentPostsPerPeriod

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
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
      setSaving(false)
    }
  }

  return (
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

      {hasChanges && (
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save schedule
        </Button>
      )}
    </div>
  )
}
