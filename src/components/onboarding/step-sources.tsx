"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"

interface Source {
  type: string
  url: string
}

interface StepSourcesProps {
  onNext: (sources: Source[]) => void
  onBack: () => void
}

const sourceTypes = [
  { value: "youtube", label: "YouTube Channel" },
  { value: "blog", label: "Blog / RSS Feed" },
  { value: "webpage", label: "Webpage" },
]

export function StepSources({ onNext, onBack }: StepSourcesProps) {
  const [sources, setSources] = useState<Source[]>([])
  const [type, setType] = useState("")
  const [url, setUrl] = useState("")

  function addSource() {
    if (!type || !url || sources.length >= 5) return
    setSources([...sources, { type, url }])
    setType("")
    setUrl("")
  }

  function removeSource(index: number) {
    setSources(sources.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add content sources</h2>
        <p className="text-sm text-muted-foreground">
          Add up to 5 sources. Our AI will scrape these daily to generate blog
          posts.
        </p>
      </div>

      {sources.length < 5 && (
        <div className="space-y-4">
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

          <Button variant="outline" onClick={addSource} disabled={!type || !url}>
            Add source
          </Button>
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-2">
          <Label>Added sources ({sources.length}/5)</Label>
          {sources.map((source, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border p-3"
            >
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {sourceTypes.find((t) => t.value === source.type)?.label}
              </span>
              <span className="flex-1 truncate text-sm">{source.url}</span>
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
        <Button onClick={() => onNext(sources)} disabled={sources.length === 0}>
          Next
        </Button>
      </div>
    </div>
  )
}
