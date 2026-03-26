"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { FREE_MONTHLY_CREDITS } from "@/lib/credits"

type Schedule = "daily" | "weekly" | "biweekly"

interface StepFinalizeProps {
  topic: string
  topicContext: Array<{ question: string; answer: string }>
  name: string
  subdomain: string
  schedule: Schedule
  postsPerPeriod: number
  onUpdate: (name: string, subdomain: string) => void
  onScheduleUpdate: (schedule: Schedule, postsPerPeriod: number) => void
  onSubmit: () => void
  onBack: () => void
  submitting: boolean
}

const RESERVED_SUBDOMAINS = [
  "www",
  "app",
  "api",
  "mail",
  "admin",
  "blog",
  "help",
  "support",
]

const scheduleOptions: { value: Schedule; label: string; recommended?: boolean }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly", recommended: true },
  { value: "biweekly", label: "Every 2 weeks" },
]

export function StepFinalize({
  topic,
  topicContext,
  name,
  subdomain,
  schedule,
  postsPerPeriod,
  onUpdate,
  onScheduleUpdate,
  onSubmit,
  onBack,
  submitting,
}: StepFinalizeProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const subdomainTooShort = subdomain.length > 0 && subdomain.length < 3
  const subdomainReserved = RESERVED_SUBDOMAINS.includes(subdomain)

  // Estimate posts per month
  const postsPerMonth =
    schedule === "daily"
      ? postsPerPeriod * 30
      : schedule === "weekly"
        ? postsPerPeriod * 4
        : postsPerPeriod * 2

  const freeMonths =
    postsPerMonth > 0
      ? Math.floor(FREE_MONTHLY_CREDITS / postsPerMonth)
      : 0

  // Fetch AI name suggestions on mount
  useEffect(() => {
    if (!topic) return
    setLoadingSuggestions(true)
    fetch("/api/ai/suggest-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, topicContext }),
    })
      .then((res) => res.json())
      .then((data) => setSuggestions(data.names || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced subdomain availability check
  useEffect(() => {
    if (
      !subdomain ||
      subdomain.length < 3 ||
      RESERVED_SUBDOMAINS.includes(subdomain)
    ) {
      setAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkSubdomain: true, subdomain }),
        })
        const data = await res.json()
        setAvailable(data.available)
      } catch {
        setAvailable(null)
      }
      setChecking(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [subdomain])

  function handleNameChange(value: string) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    onUpdate(value, slug)
  }

  const canSubmit =
    name &&
    subdomain &&
    subdomain.length >= 3 &&
    !subdomainReserved &&
    available === true &&
    !checking &&
    !submitting

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Finalize your site</h2>
        <p className="text-sm text-muted-foreground">
          Choose a name and posting schedule.
        </p>
      </div>

      {/* AI Suggestions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">AI-suggested names</p>
        </div>
        {loadingSuggestions ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleNameChange(s)}
                className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No suggestions available. Enter a name below.
          </p>
        )}
      </div>

      {/* Name + subdomain */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Site name</Label>
          <Input
            id="name"
            placeholder="My Awesome Blog"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subdomain">Subdomain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="subdomain"
              placeholder="my-blog"
              value={subdomain}
              onChange={(e) =>
                onUpdate(
                  name,
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                )
              }
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              .inkpop.net
            </span>
          </div>
          {checking && (
            <p className="text-sm text-muted-foreground">Checking...</p>
          )}
          {!checking && available === true && (
            <p className="text-sm text-success">Available</p>
          )}
          {!checking && available === false && (
            <p className="text-sm text-destructive">Already taken</p>
          )}
          {subdomainTooShort && (
            <p className="text-sm text-destructive">
              Must be at least 3 characters
            </p>
          )}
          {subdomainReserved && (
            <p className="text-sm text-destructive">
              This subdomain is reserved
            </p>
          )}
        </div>
      </div>

      {/* Schedule (inline) */}
      <div className="space-y-3">
        <Label>Posting schedule</Label>
        <div className="flex gap-2">
          {scheduleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onScheduleUpdate(option.value, option.value === "daily" ? postsPerPeriod : 1)}
              className={cn(
                "rounded border px-3 py-1.5 text-sm transition-colors",
                schedule === option.value
                  ? "bg-accent border-foreground/20 font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {option.label}
              {option.recommended && schedule !== option.value && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">(recommended)</span>
              )}
            </button>
          ))}
        </div>

        {schedule === "daily" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={10}
              value={postsPerPeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1
                onScheduleUpdate(schedule, Math.max(1, Math.min(10, val)))
              }}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">posts per day</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ~{postsPerMonth} posts/month
          {freeMonths > 0
            ? ` · Free tier covers ${freeMonths} month${freeMonths !== 1 ? "s" : ""}`
            : " · You'll need additional credits"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating site...
            </>
          ) : (
            "Create Site"
          )}
        </Button>
      </div>
    </div>
  )
}
