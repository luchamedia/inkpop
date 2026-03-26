"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, ArrowRight, Sparkles } from "lucide-react"

const RESERVED_SUBDOMAINS = [
  "www", "app", "api", "mail", "admin", "blog", "help", "support",
]

type Step = "topic" | "name"

export function NewSiteWizard() {
  const router = useRouter()
  const { toast } = useToast()

  // Step state
  const [step, setStep] = useState<Step>("topic")

  // Topic state
  const [topic, setTopic] = useState("")

  // Name state
  const [name, setName] = useState("")
  const [subdomain, setSubdomain] = useState("")
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // AI suggestions
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const subdomainTooShort = subdomain.length > 0 && subdomain.length < 3
  const subdomainReserved = RESERVED_SUBDOMAINS.includes(subdomain)

  // Fetch AI name suggestions when entering step 2
  useEffect(() => {
    if (step !== "name" || !topic.trim()) return
    setLoadingSuggestions(true)
    fetch("/api/ai/suggest-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim() }),
    })
      .then((res) => res.json())
      .then((data) => setSuggestions(data.names || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false))
  }, [step, topic])

  // Debounced subdomain availability check
  useEffect(() => {
    if (!subdomain || subdomain.length < 3 || RESERVED_SUBDOMAINS.includes(subdomain)) {
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
    setName(value)
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    setSubdomain(slug)
  }

  const canSubmit =
    name.trim() &&
    subdomain &&
    subdomain.length >= 3 &&
    !subdomainReserved &&
    available === true &&
    !checking &&
    !submitting

  async function handleSubmit() {
    setSubmitting(true)

    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subdomain,
          topic: topic.trim() || null,
        }),
      })
      const site = await res.json()

      if (!site.id) {
        toast({
          title: "Error",
          description: site.error || "Failed to create site",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      router.refresh()
      router.push(`/dashboard/sites/${site.id}`)
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
      setSubmitting(false)
    }
  }

  // --- Step 1: Topic ---
  if (step === "topic") {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            What is your blog about?
          </h2>
          <p className="text-sm text-muted-foreground">
            Describe your topic and we&apos;ll suggest a name for your site.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Topic</Label>
          <Textarea
            id="topic"
            placeholder="e.g., Sustainable living tips for urban millennials, AI tools for small business owners..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-right">
            {topic.length}/500
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setStep("name")
            }}
          >
            Skip
          </Button>
          <Button
            onClick={() => setStep("name")}
            disabled={!topic.trim()}
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // --- Step 2: Name + Subdomain ---
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Name your blog</h2>
        <p className="text-sm text-muted-foreground">
          {topic.trim()
            ? "Pick a suggested name or enter your own."
            : "You can configure everything else from your dashboard."}
        </p>
      </div>

      {/* AI Suggestions (only shown if topic was provided) */}
      {topic.trim() && (
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
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Site name</Label>
          <Input
            id="name"
            placeholder="My Awesome Blog"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            autoFocus={!topic.trim()}
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
                setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
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
            <p className="text-sm text-destructive">Must be at least 3 characters</p>
          )}
          {subdomainReserved && (
            <p className="text-sm text-destructive">This subdomain is reserved</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep("topic")}
          disabled={submitting}
        >
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
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
