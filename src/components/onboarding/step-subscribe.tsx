"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

interface StepSubscribeProps {
  onBack: () => void
}

export function StepSubscribe({ onBack }: StepSubscribeProps) {
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  const features = [
    "Daily AI-generated SEO blog posts",
    "Hosted subdomain blog",
    "Up to 5 content sources",
    "YouTube, blog, and webpage scraping",
    "One-click publish",
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Start your subscription</h2>
        <p className="text-sm text-muted-foreground">
          Subscribe to activate your site and start generating content.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <div className="mb-4">
          <span className="text-3xl font-bold">$49</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubscribe} disabled={loading}>
          {loading ? "Redirecting to checkout..." : "Subscribe now"}
        </Button>
      </div>
    </div>
  )
}
