"use client"

import { lazy, Suspense, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ExternalLink, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TabOverview } from "./tab-overview"

// Lazy-load non-default tabs to reduce initial bundle size
const TabPosts = lazy(() => import("./tab-posts").then((m) => ({ default: m.TabPosts })))
const TabContext = lazy(() => import("./tab-context").then((m) => ({ default: m.TabContext })))
const TabSources = lazy(() => import("./tab-sources").then((m) => ({ default: m.TabSources })))
const TabSettings = lazy(() => import("./tab-settings").then((m) => ({ default: m.TabSettings })))
const TabMonetization = lazy(() => import("./tab-monetization").then((m) => ({ default: m.TabMonetization })))
const TabAnalytics = lazy(() => import("./tab-analytics").then((m) => ({ default: m.TabAnalytics })))
const TabStyles = lazy(() => import("./tab-styles").then((m) => ({ default: m.TabStyles })))

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
  context_files: Record<string, unknown> | null
  auto_publish: boolean
  schedule_confirmed: boolean
  sources: SourceData[]
}

export interface SourceData {
  id: string
  type: string
  url: string
  label: string | null
  meta_title: string | null
  meta_description: string | null
  favicon_url: string | null
  og_image_url: string | null
}

export interface PostData {
  id: string
  title: string
  slug: string
  body?: string
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
  hasPaymentMethod: boolean
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "posts", label: "Posts" },
  { value: "sources", label: "Sources" },
  { value: "context", label: "Context" },
  { value: "styles", label: "Styles" },
  { value: "analytics", label: "Analytics" },
  { value: "monetization", label: "Monetization" },
  { value: "settings", label: "Settings" },
] as const

type TabValue = (typeof TABS)[number]["value"]

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function SiteDashboard({ site, drafts, published, creditBalance, hasPaymentMethod }: SiteDashboardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const currentTab = (searchParams?.get("tab") as TabValue) || "overview"

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (value === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }, [searchParams, router, pathname])

  return (
    <div>
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      {/* Sticky top bar: site name + link + tabs */}
      <div className="sticky top-0 z-30 -mx-8 -mt-8 lg:-mx-12 lg:-mt-8 px-8 lg:px-12 bg-background border-b border-border">
        <div className="flex items-center justify-between pt-5 pb-3">
          <h1 className="font-serif text-xl font-semibold tracking-tight">{site.name}</h1>
          <a
            href={`https://${site.subdomain}.inkpop.net`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {site.subdomain}.inkpop.net
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview">
        <TabOverview
          site={site}
          drafts={drafts}
          published={published}
          creditBalance={creditBalance}
          hasPaymentMethod={hasPaymentMethod}
        />
      </TabsContent>

      <TabsContent value="posts">
        <Suspense fallback={<TabLoading />}>
          <TabPosts
            site={site}
            drafts={drafts}
            published={published}
            creditBalance={creditBalance}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="context">
        <Suspense fallback={<TabLoading />}>
          <TabContext site={site} />
        </Suspense>
      </TabsContent>

      <TabsContent value="sources">
        <Suspense fallback={<TabLoading />}>
          <TabSources site={site} />
        </Suspense>
      </TabsContent>

      <TabsContent value="settings">
        <Suspense fallback={<TabLoading />}>
          <TabSettings site={site} />
        </Suspense>
      </TabsContent>

      <TabsContent value="monetization">
        <Suspense fallback={<TabLoading />}>
          <TabMonetization />
        </Suspense>
      </TabsContent>

      <TabsContent value="styles">
        <Suspense fallback={<TabLoading />}>
          <TabStyles />
        </Suspense>
      </TabsContent>

      <TabsContent value="analytics">
        <Suspense fallback={<TabLoading />}>
          <TabAnalytics />
        </Suspense>
      </TabsContent>
    </Tabs>
    </div>
  )
}
