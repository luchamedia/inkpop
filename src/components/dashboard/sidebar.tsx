"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ChevronRight,
  Globe,
  Coins,
  Plus,
  PanelLeft,
  FileText,
  BookOpen,
  LayoutDashboard,
  Settings,
} from "lucide-react"
import { useState } from "react"
import { useSidebar } from "./sidebar-context"

interface Site {
  id: string
  name: string
  subdomain: string
}

interface SidebarProps {
  creditBalance: number
  sites: Site[]
}

function SiteTreeItem({ site }: { site: Site }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isActiveSite = pathname?.includes(`/sites/${site.id}`)
  const [expanded, setExpanded] = useState(isActiveSite ?? false)
  const currentTab = searchParams?.get("tab") || "overview"

  const siteBase = `/dashboard/sites/${site.id}`
  const subItems = [
    { label: "Overview", href: siteBase, tab: "overview", icon: LayoutDashboard },
    { label: "Posts", href: `${siteBase}?tab=posts`, tab: "posts", icon: FileText },
    { label: "Context", href: `${siteBase}?tab=context`, tab: "context", icon: BookOpen },
    { label: "Settings", href: `${siteBase}?tab=settings`, tab: "settings", icon: Settings },
  ]

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors hover:bg-accent group",
          isActiveSite ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{site.name}</span>
      </button>

      {expanded && (
        <div className="ml-[18px] border-l border-border pl-2 space-y-0.5 py-0.5">
          {subItems.map((item) => {
            const isActive = isActiveSite && currentTab === item.tab
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1 text-[13px] transition-colors hover:bg-accent",
                  isActive
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


export function Sidebar({ creditBalance, sites }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()
  const hasSites = sites.length > 0

  return (
    <aside
      className={cn(
        "flex h-screen flex-col overflow-hidden border-r border-border bg-background-secondary transition-all duration-200 ease-in-out",
        collapsed ? "w-0 border-r-0" : "w-[240px]"
      )}
    >
      <div className="flex flex-col min-w-[240px] h-full p-3">
        {/* Logo header */}
        <div className="flex items-center justify-between px-2 py-1.5 mb-4">
          <Link href="/dashboard" className="font-serif text-lg font-semibold tracking-tight">
            inkpop
          </Link>
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Primary nav */}
        <nav className="space-y-0.5 mb-4">
          <Link
            href="/dashboard/sites"
            className={cn(
              "flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-accent",
              pathname === "/dashboard/sites" || pathname === "/dashboard"
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </nav>

        {/* Sites section */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sites
            </span>
            <Link
              href="/dashboard/new-site"
              className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Create new site"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>

          {hasSites ? (
            <div className="space-y-0.5">
              {sites.map((site) => (
                <SiteTreeItem key={site.id} site={site} />
              ))}
            </div>
          ) : (
            <div className="px-2 py-3">
              <p className="text-xs text-muted-foreground">
                No sites yet. Create your first AI-powered blog.
              </p>
            </div>
          )}

        </div>

        {/* Bottom section: settings + credits */}
        <div className="border-t border-border pt-3 mt-2 space-y-2">
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors hover:bg-accent",
              pathname?.startsWith("/dashboard/settings")
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <div className="flex items-center justify-between px-2 py-1.5 rounded bg-accent/50">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{creditBalance}</span>
              <span className="text-muted-foreground">credits</span>
            </div>
            <Link
              href="/dashboard/top-up"
              className="text-xs font-medium text-primary hover:underline"
            >
              Buy
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}
