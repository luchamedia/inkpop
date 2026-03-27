import { useState, useEffect } from "react"

interface UseNameSuggestionsOptions {
  topic: string
  topicContext?: Array<{ question: string; answer: string }>
  enabled?: boolean
}

interface NameSuggestionsResult {
  suggestions: string[]
  loading: boolean
}

export function useNameSuggestions({
  topic,
  topicContext,
  enabled = true,
}: UseNameSuggestionsOptions): NameSuggestionsResult {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !topic.trim()) return

    setLoading(true)
    fetch("/api/ai/suggest-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim(), topicContext }),
    })
      .then((res) => res.json())
      .then((data) => setSuggestions(data.names || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false))
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return { suggestions, loading }
}
