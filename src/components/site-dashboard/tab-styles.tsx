"use client"

import { Palette } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export function TabStyles() {
  return (
    <div className="mt-8">
      <EmptyState
        icon={Palette}
        title="Styles"
        description="Customize your blog's look and feel with themes, fonts, and colors."
        badge="Coming soon"
      />
    </div>
  )
}
