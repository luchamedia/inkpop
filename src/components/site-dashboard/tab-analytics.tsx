"use client"

import { BarChart3 } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export function TabAnalytics() {
  return (
    <div className="mt-8">
      <EmptyState
        icon={BarChart3}
        title="Analytics"
        description="Track your blog's performance, traffic, and engagement."
        badge="Coming soon"
      />
    </div>
  )
}
