"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { TabOverview } from "./tab-overview"
import { TabPosts } from "./tab-posts"
import { TabContext } from "./tab-context"
import { TabStyles } from "./tab-styles"
import { TabSettings } from "./tab-settings"
import { TabPromotions } from "./tab-promotions"
import { TabAnalytics } from "./tab-analytics"

export interface SiteData {
  id: string
  name: string
  subdomain: string
  topic: string | null
  topic_context: Record<string, unknown> | null
  description: string | null
  category: string | null
  posting_schedule: string | null
  posts_per_period: number | null
  writing_prompt: string | null
  writing_prompt_inputs: Record<string, unknown> | null
  sources: SourceData[]
}

export interface SourceData {
  id: string
  type: string
  url: string
  label: string | null
}

export interface PostData {
  id: string
  title: string
  slug: string
  body: string
  meta_description: string | null
  status: string
  generated_at: string
  published_at: string | null
  created_at: string
}

interface SiteDashboardProps {
  site: SiteData
  drafts: PostData[]
  published: PostData[]
  creditBalance: number
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "posts", label: "Posts" },
  { value: "context", label: "Context" },
  { value: "styles", label: "Styles" },
  { value: "settings", label: "Settings" },
  { value: "promotions", label: "Promotions" },
  { value: "analytics", label: "Analytics" },
] as const

type TabValue = (typeof TABS)[number]["value"]

export function SiteDashboard({ site, drafts, published, creditBalance }: SiteDashboardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const currentTab = (searchParams?.get("tab") as TabValue) || "overview"

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (value === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }

  return (
    <div>
      {/* Site header — persistent above tabs */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{site.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <a
              href={`https://${site.subdomain}.inkpop.net`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {site.subdomain}.inkpop.net
              <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
          </p>
        </div>
        <RunAgentButton siteId={site.id} creditBalance={creditBalance} />
      </div>

    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <TabOverview
          site={site}
          drafts={drafts}
          published={published}
          creditBalance={creditBalance}
        />
      </TabsContent>

      <TabsContent value="posts">
        <TabPosts
          site={site}
          drafts={drafts}
          published={published}
          creditBalance={creditBalance}
        />
      </TabsContent>

      <TabsContent value="context">
        <TabContext site={site} />
      </TabsContent>

      <TabsContent value="styles">
        <TabStyles />
      </TabsContent>

      <TabsContent value="settings">
        <TabSettings site={site} />
      </TabsContent>

      <TabsContent value="promotions">
        <TabPromotions />
      </TabsContent>

      <TabsContent value="analytics">
        <TabAnalytics />
      </TabsContent>
    </Tabs>
    </div>
  )
}
