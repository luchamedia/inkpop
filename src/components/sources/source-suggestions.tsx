"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Search, Plus, RefreshCw } from "lucide-react"
import type { SuggestedSource } from "@/lib/mindstudio"

interface SourceSuggestionsProps {
  onAccept: (source: { type: string; url: string; label: string }) => void
  existingUrls: string[]
  remainingSlots: number
  initialQuery?: string
}

const typeLabels: Record<string, string> = {
  youtube: "YouTube",
  blog: "Blog",
  webpage: "Webpage",
}

export function SourceSuggestions({
  onAccept,
  existingUrls,
  remainingSlots,
  initialQuery,
}: SourceSuggestionsProps) {
  const [query, setQuery] = useState(initialQuery || "")
  const [suggestions, setSuggestions] = useState<SuggestedSource[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasSearched, setHasSearched] = useState(false)
  const { toast } = useToast()
  const autoSearched = useRef(false)

  // Auto-search when initialQuery is provided
  useEffect(() => {
    if (initialQuery && !autoSearched.current && !hasSearched) {
      autoSearched.current = true
      const timer = setTimeout(() => search(1), 300)
      return () => clearTimeout(timer)
    }
  }, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  if (remainingSlots <= 0) return null

  async function search(nextPage: number = 1) {
    if (!query.trim()) return
    setLoading(true)

    try {
      const allShownUrls = [
        ...existingUrls,
        ...suggestions.map((s) => s.url),
      ]

      const res = await fetch("/api/ai/suggest-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: query.trim(),
          existingUrls: allShownUrls,
          page: nextPage,
        }),
      })

      const data = await res.json()

      if (data.message) {
        toast({
          title: "Search limited",
          description: data.message,
          variant: "destructive",
        })
      }

      const newSuggestions = data.suggestions || []

      if (nextPage === 1) {
        setSuggestions(newSuggestions)
      } else {
        // Append, deduping by URL
        const existingSet = new Set(suggestions.map((s) => s.url))
        const fresh = newSuggestions.filter(
          (s: SuggestedSource) => !existingSet.has(s.url)
        )
        setSuggestions([...suggestions, ...fresh])
      }

      setPage(nextPage)
      setHasSearched(true)
    } catch {
      toast({
        title: "Error",
        description: "Failed to search for sources. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function handleAccept(suggestion: SuggestedSource) {
    onAccept({
      type: suggestion.type,
      url: suggestion.url,
      label: suggestion.label,
    })
    setSuggestions(suggestions.filter((s) => s.url !== suggestion.url))
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Find sources with AI</p>
        <div className="flex gap-2">
          <Input
            placeholder="Enter your niche or topic..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search(1)
            }}
          />
          <Button
            onClick={() => search(1)}
            disabled={!query.trim() || loading}
            size="default"
          >
            <Search className="h-4 w-4 mr-2" />
            {loading && !hasSearched ? "Searching..." : "Find Sources"}
          </Button>
        </div>
      </div>

      {loading && suggestions.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Searching for sources...
          </p>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {suggestions.length} source{suggestions.length !== 1 ? "s" : ""}{" "}
            found
          </p>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.url}
              className={`flex items-start gap-3 rounded-md border p-3 ${
                suggestion.confidence === "low"
                  ? "opacity-60 border-dashed"
                  : ""
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {typeLabels[suggestion.type] || suggestion.type}
                  </Badge>
                  <span className="text-sm font-medium truncate">
                    {suggestion.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {suggestion.url}
                </p>
                <p className="text-xs text-muted-foreground">
                  {suggestion.reason}
                </p>
                {suggestion.confidence === "low" && (
                  <p className="text-xs text-amber-600">
                    May not be directly related to your topic
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAccept(suggestion)}
                disabled={remainingSlots <= 0}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => search(page + 1)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3 w-3 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Searching..." : "Find more"}
          </Button>
        </div>
      )}

      {hasSearched && !loading && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No sources found. Try different keywords.
        </p>
      )}
    </div>
  )
}
