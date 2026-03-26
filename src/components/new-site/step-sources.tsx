"use client"

import { useState } from "react"
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
import { SourceSuggestions } from "@/components/sources/source-suggestions"
import { SOURCE_LIMIT } from "@/lib/credits"
import { X, ChevronDown, ChevronUp } from "lucide-react"

interface Source {
  type: string
  url: string
  label?: string
}

interface StepSourcesProps {
  topic: string
  sources: Source[]
  onUpdate: (sources: Source[]) => void
  onNext: () => void
  onBack: () => void
}

const sourceTypes = [
  { value: "youtube", label: "YouTube Channel" },
  { value: "blog", label: "Blog / RSS Feed" },
  { value: "webpage", label: "Webpage" },
]

export function StepSources({
  topic,
  sources,
  onUpdate,
  onNext,
  onBack,
}: StepSourcesProps) {
  const [type, setType] = useState("")
  const [url, setUrl] = useState("")
  const [showManual, setShowManual] = useState(false)

  function addSource() {
    if (!type || !url || sources.length >= SOURCE_LIMIT) return
    onUpdate([...sources, { type, url }])
    setType("")
    setUrl("")
  }

  function removeSource(index: number) {
    onUpdate(sources.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Add content sources</h2>
        <p className="text-sm text-muted-foreground">
          Add up to {SOURCE_LIMIT} sources. Our AI will scrape these to generate
          blog posts.
        </p>
      </div>

      {sources.length < SOURCE_LIMIT && (
        <>
          <SourceSuggestions
            onAccept={(source) => {
              if (sources.length < SOURCE_LIMIT) {
                onUpdate([
                  ...sources,
                  { type: source.type, url: source.url, label: source.label },
                ])
              }
            }}
            existingUrls={sources.map((s) => s.url)}
            remainingSlots={SOURCE_LIMIT - sources.length}
            initialQuery={topic}
          />

          <div>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {showManual ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Or add a source manually
            </button>

            {showManual && (
              <div className="mt-3 flex items-center gap-2">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-[160px] shrink-0">
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
                <Input
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSource()
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSource}
                  disabled={!type || !url}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {sources.length > 0 && (
        <div className="space-y-2">
          <Label>
            Added sources ({sources.length}/{SOURCE_LIMIT})
          </Label>
          {sources.map((source, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border p-3"
            >
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {sourceTypes.find((t) => t.value === source.type)?.label ||
                  source.type}
              </span>
              <span className="flex-1 truncate text-sm">
                {source.label || source.url}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSource(i)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={sources.length === 0}>
          Next
        </Button>
      </div>
    </div>
  )
}
