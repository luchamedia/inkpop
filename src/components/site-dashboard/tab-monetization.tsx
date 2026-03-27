"use client"

import { CircleDollarSign } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export function TabMonetization() {
  return (
    <div className="mt-8">
      <EmptyState
        icon={CircleDollarSign}
        title="Monetization"
        description="Enable ads, add CTA interstitials, and create email signup forms to grow your audience and revenue."
        badge="Coming soon"
      />
    </div>
  )
}
