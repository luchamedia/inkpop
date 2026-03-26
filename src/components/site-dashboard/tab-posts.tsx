"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard } from "@/components/posts/post-card"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { ScheduleConfigCard } from "@/components/dashboard/schedule-config-card"
import type { SiteData, PostData } from "./site-dashboard"

interface TabPostsProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
}

export function TabPosts({ site, drafts, published, creditBalance }: TabPostsProps) {
  return (
    <div className="mt-6 space-y-6">
      <div>
        <h3 className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Posting Schedule
        </h3>
        <ScheduleConfigCard
          siteId={site.id}
          currentSchedule={site.posting_schedule || "weekly"}
          currentPostsPerPeriod={site.posts_per_period || 1}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Content Inbox
          </h3>
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
          </TabsList>

          <TabsContent value="drafts" className="mt-4">
            {drafts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No drafts yet. Click &quot;Run Agent&quot; to generate content.
              </p>
            ) : (
              <div className="grid gap-3">
                {drafts.map((post) => (
                  <PostCard key={post.id} post={post} siteId={site.id} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="published" className="mt-4">
            {published.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No published posts yet.</p>
            ) : (
              <div className="grid gap-3">
                {published.map((post) => (
                  <PostCard key={post.id} post={post} siteId={site.id} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
