"use client"

import { FileText, Lightbulb } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { PostCard } from "@/components/posts/post-card"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { PostScheduleCard } from "./post-schedule-card"
import { IdeaList } from "./idea-list"
import type { SiteData, PostData } from "./site-dashboard"

interface TabPostsProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
}

export function TabPosts({ site, drafts, published, creditBalance }: TabPostsProps) {
  return (
    <div className="mt-8 space-y-8">
      <PostScheduleCard site={site} />

      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-serif text-sm font-medium">Content Inbox</h3>
            </div>
            <RunAgentButton siteId={site.id} creditBalance={creditBalance} size="sm" />
          </div>

          <Tabs defaultValue="ideas">
            <TabsList>
              <TabsTrigger value="ideas">
                <Lightbulb className="h-3 w-3 mr-1" />
                Ideas
              </TabsTrigger>
              <TabsTrigger value="drafts">
                Drafts ({drafts.length})
              </TabsTrigger>
              <TabsTrigger value="published">
                Published ({published.length})
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
              <IdeaList siteId={site.id} creditBalance={creditBalance} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
