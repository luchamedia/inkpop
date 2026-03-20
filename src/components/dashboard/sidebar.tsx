"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Globe } from "lucide-react"

const navItems = [
  { label: "Sites", href: "/dashboard/sites", icon: Globe },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-muted/40 p-4">
      <div className="mb-8">
        <Link href="/dashboard" className="text-xl font-bold">
          inkpop
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
              pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href))
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t pt-4">
        <UserButton afterSignOutUrl="/" />
      </div>
    </aside>
  )
}
