"use client"

import { useState } from "react"
import { FileText, Lightbulb, ListOrdered } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { PostCard } from "@/components/posts/post-card"
import { PostScheduleCard } from "./post-schedule-card"
import { IdeaList } from "./idea-list"
import { QueueList } from "./queue-list"
import type { SiteData, PostData } from "./site-dashboard"

interface TabPostsProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
  initialQueueCount?: number
}

export function TabPosts({ site, drafts, published, creditBalance, initialQueueCount = 0 }: TabPostsProps) {
  const [queueCount, setQueueCount] = useState(initialQueueCount)

  return (
    <div className="mt-8 space-y-8">
      <PostScheduleCard site={site} />

      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-sm font-medium">Content Inbox</h3>
          </div>

          <Tabs defaultValue="ideas">
            <TabsList>
              <TabsTrigger value="ideas">
                <Lightbulb className="h-3 w-3 mr-1" />
                Ideas
              </TabsTrigger>
              <TabsTrigger value="queue">
                <ListOrdered className="h-3 w-3 mr-1" />
                Queue{queueCount > 0 ? ` (${queueCount})` : ""}
              </TabsTrigger>
              <TabsTrigger value="drafts">
                Drafts ({drafts.length})
              </TabsTrigger>
              <TabsTrigger value="published">
                Published ({published.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ideas" className="mt-4">
              <IdeaList siteId={site.id} creditBalance={creditBalance} />
            </TabsContent>

            <TabsContent value="queue" className="mt-4">
              <QueueList
                siteId={site.id}
                creditBalance={creditBalance}
                onQueueChange={setQueueCount}
              />
            </TabsContent>

            <TabsContent value="drafts" className="mt-4">
              {drafts.length === 0 ? (
                <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
                  <p className="text-sm text-muted-foreground">
                    No drafts yet. Generate ideas first, then create posts from them.
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
