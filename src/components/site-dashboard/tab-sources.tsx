"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Link2, Plus, Sparkles, RefreshCw, X, Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SourceCard } from "@/components/sources/source-card"
import { isValidUrl, detectSourceType } from "@/lib/url-utils"
import { SOURCE_LIMIT } from "@/lib/credits"
import type { SiteData, SourceData } from "./site-dashboard"

interface SuggestionRow {
  id: string
  type: string
  url: string
  label: string
  reason: string | null
  status: string
  meta_title: string | null
  meta_description: string | null
  favicon_url: string | null
  og_image_url: string | null
}

interface TabSourcesProps {
  site: SiteData
}

const sourceTypes = [
  { value: "youtube", label: "YouTube Channel" },
  { value: "blog", label: "Blog / RSS Feed" },
  { value: "webpage", label: "Webpage" },
]

export function TabSources({ site }: TabSourcesProps) {
  const { toast } = useToast()

  // Source state
  const [sources, setSources] = useState<SourceData[]>(site.sources)

  // Manual add form state
  const [type, setType] = useState("")
  const [url, setUrl] = useState("")
  const [addLoading, setAddLoading] = useState(false)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  // Sync sources if site data changes
  useEffect(() => {
    setSources(site.sources)
  }, [site.sources])

  // Load persisted suggestions on mount
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch(`/api/sites/${site.id}/suggestions`)
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false))
  }, [site.id])

  // --- Source actions ---

  function handleUrlChange(value: string) {
    setUrl(value)
    if (value && isValidUrl(value)) {
      const detected = detectSourceType(value)
      if (!type || type !== detected) setType(detected)
    }
  }

  const urlValid = !url || isValidUrl(url)

  async function addSource() {
    if (!type || !url || !isValidUrl(url)) return
    setAddLoading(true)
    try {
      const res = await fetch(`/api/sites/${site.id}/sources`, {
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
    } finally {
      setAddLoading(false)
    }
  }

  async function removeSource(sourceId: string) {
    const previous = sources
    setSources((prev) => prev.filter((s) => s.id !== sourceId))
    toast({ title: "Source removed" })

    const res = await fetch(`/api/sites/${site.id}/sources?sourceId=${sourceId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      setSources(previous)
      toast({ title: "Error", description: "Failed to remove source", variant: "destructive" })
    }
  }

  // --- Suggestion actions ---

  async function acceptSuggestion(suggestion: SuggestionRow) {
    setAcceptingId(suggestion.id)
    try {
      // Add as source
      const res = await fetch(`/api/sites/${site.id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: suggestion.type,
          url: suggestion.url,
          label: suggestion.label,
        }),
      })

      if (res.ok) {
        const newSource = await res.json()
        setSources((prev) => [...prev, newSource])
        // Mark suggestion as accepted
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))
        fetch(`/api/sites/${site.id}/suggestions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId: suggestion.id, status: "accepted" }),
        }).catch(() => {})
        toast({ title: "Source added" })
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } finally {
      setAcceptingId(null)
    }
  }

  async function dismissSuggestion(suggestionId: string) {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
    fetch(`/api/sites/${site.id}/suggestions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionId, status: "dismissed" }),
    }).catch(() => {})
  }

  async function refreshSuggestions() {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/sites/${site.id}/suggestions`, {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions((prev) => {
          const existingIds = new Set(prev.map((s) => s.id))
          const fresh = (data.suggestions || []).filter(
            (s: SuggestionRow) => !existingIds.has(s.id)
          )
          return [...prev, ...fresh]
        })
        toast({ title: "New suggestions found" })
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to refresh suggestions", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  const atLimit = sources.length >= SOURCE_LIMIT

  return (
    <div className="mt-8 space-y-8">
      {/* Section 1: My Sources of Truth */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide font-medium">
              My Sources of Truth
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {sources.length}/{SOURCE_LIMIT}
          </span>
        </div>

        {sources.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                onDelete={removeSource}
              />
            ))}
          </div>
        ) : (
          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center py-6">
                <Link2 className="h-8 w-8 text-muted-foreground/60 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No sources added yet. Add URLs so the AI knows what content to reference when generating posts.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 2: Add a Source */}
      {!atLimit && (
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Plus className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">
                Add a Source
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="sm:w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex-1 space-y-1">
                <Input
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSource()
                  }}
                />
                {url && !urlValid && (
                  <p className="text-xs text-destructive">
                    Must start with http:// or https://
                  </p>
                )}
              </div>

              <Button
                onClick={addSource}
                disabled={!type || !url || !urlValid || addLoading}
                className="shrink-0"
              >
                {addLoading ? "Adding..." : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Source Suggestions */}
      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">
                Source Suggestions
              </span>
            </div>
            {site.topic && (
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshSuggestions}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3 w-3 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Searching..." : "Refresh"}
              </Button>
            )}
          </div>

          {/* Loading state */}
          {suggestionsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Suggestions grid */}
          {!suggestionsLoading && suggestions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggestions.map((suggestion) => {
                const isAccepting = acceptingId === suggestion.id
                const isAlreadyAdded = sources.some(
                  (s) => s.url === suggestion.url
                )
                return (
                  <SourceCard
                    key={suggestion.id}
                    source={{
                      id: suggestion.id,
                      type: suggestion.type,
                      url: suggestion.url,
                      label: suggestion.label,
                      meta_title: suggestion.meta_title,
                      meta_description: suggestion.meta_description,
                      favicon_url: suggestion.favicon_url,
                      og_image_url: null,
                    }}
                    reason={suggestion.reason}
                    actions={
                      isAlreadyAdded ? (
                        <p className="text-xs text-muted-foreground italic">
                          Already in your sources
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => acceptSuggestion(suggestion)}
                            disabled={atLimit || isAccepting}
                          >
                            {isAccepting ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            {isAccepting ? "Adding..." : "Add"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0"
                            onClick={() => dismissSuggestion(suggestion.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    }
                  />
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {!suggestionsLoading && suggestions.length === 0 && (
            <div className="flex flex-col items-center text-center py-6">
              <Sparkles className="h-8 w-8 text-muted-foreground/60 mb-3" />
              {site.topic ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    No suggestions yet. Click refresh to discover sources for your topic.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshSuggestions}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-3 w-3 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Searching..." : "Find Sources"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set a topic in the Context tab to get AI-powered source suggestions.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
