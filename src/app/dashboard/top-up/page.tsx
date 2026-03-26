"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const packs = [
  {
    id: "pack_10" as const,
    label: "Starter",
    credits: 10,
    price: "$5",
    perPost: "$0.50/post",
    badge: null,
  },
  {
    id: "pack_50" as const,
    label: "Standard",
    credits: 50,
    price: "$22.50",
    perPost: "$0.45/post",
    badge: "Save 10%",
  },
  {
    id: "pack_100" as const,
    label: "Bulk",
    credits: 100,
    price: "$40",
    perPost: "$0.40/post",
    badge: "Save 20%",
  },
]

const features = [
  "AI-generated SEO blog posts",
  "Unlimited sites",
  "Up to 10 content sources per site",
  "Hosted subdomain blog",
  "One-click publish",
]

export default function SubscribePage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [autoRenew, setAutoRenew] = useState(false)
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false)

  useEffect(() => {
    fetch("/api/billing/auto-renew")
      .then((r) => r.json())
      .then((data) => {
        setAutoRenew(data.auto_renew ?? false)
        setHasPaymentMethod(data.has_payment_method ?? false)
      })
      .catch(() => {})
  }, [])

  async function handleToggle(checked: boolean) {
    setAutoRenew(checked)
    // When toggling on without a pack, we'll set the pack at checkout time
    await fetch("/api/billing/auto-renew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: checked, pack: checked ? "pack_10" : undefined }),
    }).catch(() => setAutoRenew(!checked))
  }

  async function handleBuy(packId: string) {
    setLoading(packId)
    try {
      // If auto-renew is on, update the pack to match what they're buying
      if (autoRenew) {
        await fetch("/api/billing/auto-renew", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true, pack: packId }),
        })
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: packId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.assign(data.url)
      }
    } catch {
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Buy Post Credits</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Each credit generates one AI blog post. Buy more, save more.
        </p>
      </div>

      <div className="mb-8">
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-3 w-3 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Switch
          id="auto-renew-subscribe"
          checked={autoRenew}
          onCheckedChange={handleToggle}
          disabled={!hasPaymentMethod && !autoRenew}
        />
        <Label htmlFor="auto-renew-subscribe" className="text-sm">
          Auto-renew when credits run out
        </Label>
      </div>

      <div className="grid w-full max-w-3xl gap-6 md:grid-cols-3">
        {packs.map((pack) => (
          <div key={pack.id} className="relative flex flex-col border border-border rounded p-6 gap-4">
            {pack.badge && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded bg-ink-yellow-bg px-2.5 py-0.5 text-[11px] font-medium text-ink-yellow-text">
                {pack.badge}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{pack.label}</p>
              <p className="mt-2 text-3xl font-semibold font-serif">{pack.price}</p>
              <p className="text-sm text-muted-foreground">{pack.credits} posts &middot; {pack.perPost}</p>
            </div>
            <Button
              className="w-full mt-auto"
              onClick={() => handleBuy(pack.id)}
              disabled={loading !== null}
            >
              {loading === pack.id ? "Redirecting..." : `Buy ${pack.credits} Credits`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
