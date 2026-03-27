"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Link2,
  FileText,
  CalendarClock,
  CreditCard,
  Sparkles,
  Globe,
  Check,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { useToast } from "@/hooks/use-toast"
import { patchSite } from "@/lib/client-helpers"
import type { SiteData, PostData } from "./site-dashboard"

interface SetupProgressProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
  hasPaymentMethod: boolean
}

interface SetupStep {
  id: string
  title: string
  description: string
  icon: LucideIcon
  isComplete: boolean
  cta: React.ReactNode
}

export function SetupProgress({
  site,
  drafts,
  published,
  creditBalance,
  hasPaymentMethod,
}: SetupProgressProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [confirmingSchedule, setConfirmingSchedule] = useState(false)

  const scheduleLabel =
    site.posting_schedule === "daily"
      ? "Daily"
      : site.posting_schedule === "biweekly"
        ? "Every 2 weeks"
        : site.posting_schedule === "monthly"
          ? "Monthly"
          : "Weekly"

  async function handleConfirmSchedule() {
    setConfirmingSchedule(true)
    try {
      const res = await patchSite(site.id, { schedule_confirmed: true })
      if (res.ok) {
        toast({ title: "Schedule confirmed" })
        router.refresh()
      }
    } catch {
      toast({ title: "Error", description: "Failed to confirm schedule", variant: "destructive" })
    } finally {
      setConfirmingSchedule(false)
    }
  }

  const steps: SetupStep[] = [
    {
      id: "add-sources",
      title: "Add content sources",
      description: "Add URLs the AI will scrape for research when generating posts.",
      icon: Link2,
      isComplete: site.sources.length > 0,
      cta: (
        <Button asChild size="sm" variant="outline">
          <Link href="?tab=sources">Add Sources</Link>
        </Button>
      ),
    },
    {
      id: "writing-prompt",
      title: "Customize writing prompt",
      description: "Review and refine how the AI writes your blog posts.",
      icon: FileText,
      isComplete: !!site.writing_prompt,
      cta: (
        <Button asChild size="sm" variant="outline">
          <Link href="?tab=context">Set Up Prompt</Link>
        </Button>
      ),
    },
    {
      id: "confirm-schedule",
      title: "Confirm posting schedule",
      description: `Currently set to ${scheduleLabel}, ${site.posts_per_period || 1} post${(site.posts_per_period || 1) !== 1 ? "s" : ""} per period.`,
      icon: CalendarClock,
      isComplete: site.schedule_confirmed,
      cta: (
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href="?tab=posts">Change</Link>
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmSchedule}
            disabled={confirmingSchedule}
          >
            {confirmingSchedule ? "Saving..." : "Looks Good"}
          </Button>
        </div>
      ),
    },
    {
      id: "setup-payments",
      title: "Set up payments",
      description: "Add a payment method so you can buy post credits.",
      icon: CreditCard,
      isComplete: hasPaymentMethod,
      cta: (
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/top-up">Buy Credits</Link>
        </Button>
      ),
    },
    {
      id: "generate-post",
      title: "Generate your first post",
      description: "Use AI to create a blog post from your sources.",
      icon: Sparkles,
      isComplete: drafts.length > 0 || published.length > 0,
      cta: <RunAgentButton siteId={site.id} creditBalance={creditBalance} size="sm" />,
    },
    {
      id: "publish-post",
      title: "Publish your first post",
      description: "Review a draft and publish it to your blog.",
      icon: Globe,
      isComplete: published.length > 0,
      cta: (
        <Button asChild size="sm" variant="outline">
          <Link href="?tab=posts">Review Drafts</Link>
        </Button>
      ),
    },
  ]

  const completedCount = steps.filter((s) => s.isComplete).length
  const totalSteps = steps.length
  const incompleteSteps = steps.filter((s) => !s.isComplete)

  if (incompleteSteps.length === 0) return null

  const progressPercent = (completedCount / totalSteps) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold">Get started</h2>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {totalSteps} complete
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {incompleteSteps.map((step) => (
          <Card key={step.id} className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <step.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <div className="shrink-0">{step.cta}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {completedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3 w-3" />
          <span>
            {completedCount} step{completedCount !== 1 ? "s" : ""} completed
          </span>
        </div>
      )}
    </div>
  )
}
