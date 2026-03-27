"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SourceSuggestions } from "@/components/sources/source-suggestions"
import type { SourceData } from "./site-dashboard"

interface SourceManagerProps {
  siteId: string
  initialSources: SourceData[]
  topic: string | null
}

const SOURCE_LIMIT = 10

const sourceTypes = [
  { value: "youtube", label: "YouTube Channel" },
  { value: "blog", label: "Blog / RSS Feed" },
  { value: "webpage", label: "Webpage" },
]

export function SourceManager({ siteId, initialSources, topic: _topic }: SourceManagerProps) {
  const { toast } = useToast()
  const [sources, setSources] = useState<SourceData[]>(initialSources)
  const [type, setType] = useState("")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    setSources(initialSources)
  }, [initialSources])

  async function addSource() {
    if (!type || !url) return
    setLoading(true)
    const res = await fetch(`/api/sites/${siteId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, url }),
    })
    if (res.ok) {
      const newSource = await res.json()
      setSources((prev) => [...prev, newSource])
      setType("")
      setUrl("")
      toast({ title: "Source added" })
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
    setLoading(false)
  }

  async function removeSource(sourceId: string) {
    // Optimistic: remove from UI immediately
    const previous = sources
    setSources((prev) => prev.filter((s) => s.id !== sourceId))
    toast({ title: "Source removed" })

    const res = await fetch(`/api/sites/${siteId}/sources?sourceId=${sourceId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      // Revert on failure
      setSources(previous)
      toast({ title: "Error", description: "Failed to remove source", variant: "destructive" })
    }
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        {sources.length}/{SOURCE_LIMIT} sources configured
      </p>

      {sources.length < SOURCE_LIMIT && (
        <div className="mb-6 space-y-4">
          <SourceSuggestions
            onAccept={async (source) => {
              const res = await fetch(`/api/sites/${siteId}/sources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: source.type,
                  url: source.url,
                  label: source.label,
                }),
              })
              if (res.ok) {
                const newSource = await res.json()
                setSources((prev) => [...prev, newSource])
                toast({ title: "Source added" })
              } else {
                const data = await res.json()
                toast({ title: "Error", description: data.error, variant: "destructive" })
              }
            }}
            existingUrls={sources.map((s) => s.url)}
            remainingSlots={SOURCE_LIMIT - sources.length}
          />

          <div>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Or add a source manually
            </button>

            {showManual && (
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <Label>Source type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <Button onClick={addSource} disabled={!type || !url || loading}>
                  {loading ? "Adding..." : "Add source"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-0 divide-y divide-border">
        {sources.map((source) => (
          <div key={source.id} className="flex items-center gap-2 py-3">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {sourceTypes.find((t) => t.value === source.type)?.label}
            </span>
            <span className="flex-1 truncate text-sm">{source.url}</span>
            <Button variant="ghost" size="sm" onClick={() => removeSource(source.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="text-sm text-muted-foreground pt-2">
            No sources added yet. Add sources so the AI knows what content to reference.
          </p>
        )}
      </div>
    </div>
  )
}
