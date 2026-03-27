"use client"

import Link from "next/link"
import {
  FileText,
  Link2,
  Coins,
  BookOpen,
  CalendarClock,
  ArrowRight,
  Globe,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { SetupProgress } from "./setup-progress"
import type { SiteData, PostData } from "./site-dashboard"

interface TabOverviewProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
  hasPaymentMethod: boolean
}

export function TabOverview({ site, drafts, published, creditBalance, hasPaymentMethod }: TabOverviewProps) {
  const draftCount = drafts.length
  const publishedCount = published.length
  const sourceCount = site.sources?.length || 0
  const latestPost = published[0] || drafts[0]

  const scheduleLabel =
    site.posting_schedule === "daily"
      ? "Daily"
      : site.posting_schedule === "biweekly"
        ? "Every 2 weeks"
        : site.posting_schedule === "monthly"
          ? "Monthly"
          : "Weekly"

  return (
    <div className="mt-8 space-y-8">
      <SetupProgress
        site={site}
        drafts={drafts}
        published={published}
        hasPaymentMethod={hasPaymentMethod}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Link2 className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Sources</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight">{sourceCount}</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Drafts</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight">{draftCount}</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Globe className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Published</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight">{publishedCount}</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Coins className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">Credits</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight">{creditBalance}</p>
          </CardContent>
        </Card>
      </div>

      {/* Primary section cards — Posts & Sources */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Posts */}
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif text-sm font-medium">Posts</h3>
              </div>
              <div className="flex items-center gap-2">
                {(draftCount + publishedCount > 0) && (
                  <Link
                    href="?tab=posts"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                <RunAgentButton siteId={site.id} creditBalance={creditBalance} size="sm" />
              </div>
            </div>
            {draftCount + publishedCount > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div>
                    <p className="text-lg font-semibold">{publishedCount}</p>
                    <p className="text-xs text-muted-foreground">published</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{draftCount}</p>
                    <p className="text-xs text-muted-foreground">
                      draft{draftCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {latestPost && (
                  <div className="rounded bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Latest</p>
                    <p className="text-sm font-medium truncate">{latestPost.title}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
                <p className="text-sm text-muted-foreground">
                  No posts yet. Generate your first AI-powered blog post.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sources */}
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif text-sm font-medium">Sources</h3>
              </div>
              {sourceCount > 0 && (
                <Link
                  href="?tab=context"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            {sourceCount > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {site.sources.slice(0, 5).map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground max-w-[180px] truncate"
                    >
                      {s.label || new URL(s.url).hostname.replace("www.", "")}
                    </span>
                  ))}
                  {sourceCount > 5 && (
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      +{sourceCount - 5} more
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sourceCount} source{sourceCount !== 1 ? "s" : ""} configured
                </p>
              </div>
            ) : (
              <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
                <Link2 className="h-8 w-8 text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Add URLs for the AI to scrape when generating blog posts.
                </p>
                <Button asChild size="sm">
                  <Link href="?tab=context">
                    Add sources
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary section cards — Topic & Schedule */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Topic / Context */}
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif text-sm font-medium">Topic & Context</h3>
              </div>
              {site.topic && (
                <Link
                  href="?tab=context"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Edit <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            {site.topic ? (
              <div className="space-y-2">
                <p className="text-sm font-medium leading-snug">{site.topic}</p>
                {site.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {site.description}
                  </p>
                )}
                {site.category && (
                  <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {site.category}
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Define what your blog is about so the AI can generate relevant content.
                </p>
                <Button asChild size="sm">
                  <Link href="?tab=context">
                    Set your topic
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-serif text-sm font-medium">Schedule</h3>
              </div>
              <Link
                href="?tab=posts"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Change <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold">{scheduleLabel}</p>
              <p className="text-xs text-muted-foreground">
                {site.posts_per_period || 1} post{(site.posts_per_period || 1) !== 1 ? "s" : ""} per
                period
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
