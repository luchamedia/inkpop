"use client"

import { Paintbrush } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export function TabStyles() {
  return (
    <div className="mt-6">
      <EmptyState
        icon={Paintbrush}
        title="Site Styles"
        description="Customize your blog's layout, colors, typography, and design tokens."
        badge="Coming soon"
      />
    </div>
  )
}
