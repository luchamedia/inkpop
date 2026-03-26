"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { key: "account", label: "Account" },
  { key: "billing", label: "Billing" },
]

export function SettingsTabs({ children }: { children: Record<string, React.ReactNode> }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const currentTab = searchParams?.get("tab") || "account"

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/dashboard/settings?tab=${tab.key}`)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors -mb-px",
              currentTab === tab.key
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children[currentTab]}
    </div>
  )
}
