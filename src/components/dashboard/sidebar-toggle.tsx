"use client"

import { PanelLeft } from "lucide-react"
import { useSidebar } from "./sidebar-context"

export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar()

  if (!collapsed) return null

  return (
    <button
      onClick={toggle}
      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Expand sidebar"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  )
}
