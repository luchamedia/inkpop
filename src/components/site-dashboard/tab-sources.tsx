"use client"

import { SourceManager } from "./source-manager"
import type { SiteData } from "./site-dashboard"

interface TabSourcesProps {
  site: SiteData
}

export function TabSources({ site }: TabSourcesProps) {
  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold">Content Sources</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add URLs the AI will scrape for research when generating blog posts. Up to 10 sources per site.
        </p>
      </div>
      <SourceManager siteId={site.id} initialSources={site.sources} topic={site.topic} />
    </div>
  )
}
