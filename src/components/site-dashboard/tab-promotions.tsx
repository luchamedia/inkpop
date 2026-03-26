"use client"

import { Megaphone } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export function TabPromotions() {
  return (
    <div className="mt-6">
      <EmptyState
        icon={Megaphone}
        title="Promotions"
        description="Promote your blog posts across social media and other channels."
        badge="Coming soon"
      />
    </div>
  )
}
