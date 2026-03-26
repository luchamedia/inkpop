"use client"

import { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark" | "system"

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && getSystemDark())
  document.documentElement.classList.toggle("dark", dark)
  localStorage.setItem("theme", theme)
}

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function AppearanceSection() {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    if (stored === "dark" || stored === "system") {
      setTheme(stored)
    } else if (stored !== "light") {
      // Legacy or missing value — infer from current state
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    }
  }, [])

  function select(value: Theme) {
    setTheme(value)
    applyTheme(value)
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Choose how inkpop looks for you.</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => select(opt.value)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors",
              theme === opt.value
                ? "border-primary bg-accent text-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <opt.icon className="h-4 w-4" />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
