"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
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
import { Card, CardContent } from "@/components/ui/card"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Source {
  id: string
  type: string
  url: string
}

const sourceTypes = [
  { value: "youtube", label: "YouTube Channel" },
  { value: "blog", label: "Blog / RSS Feed" },
  { value: "webpage", label: "Webpage" },
]

export default function SourcesPage() {
  const params = useParams()
  const siteId = params?.siteId as string
  const { toast } = useToast()

  const [sources, setSources] = useState<Source[]>([])
  const [type, setType] = useState("")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSources()
  }, [siteId])

  async function fetchSources() {
    const res = await fetch(`/api/sites/${siteId}/sources`)
    const data = await res.json()
    if (Array.isArray(data)) setSources(data)
  }

  async function addSource() {
    if (!type || !url) return
    setLoading(true)

    const res = await fetch(`/api/sites/${siteId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, url }),
    })

    if (res.ok) {
      setType("")
      setUrl("")
      await fetchSources()
      toast({ title: "Source added" })
    } else {
      const data = await res.json()
      toast({ title: "Error", description: data.error, variant: "destructive" })
    }
    setLoading(false)
  }

  async function removeSource(sourceId: string) {
    await fetch(`/api/sites/${siteId}/sources?sourceId=${sourceId}`, {
      method: "DELETE",
    })
    await fetchSources()
    toast({ title: "Source removed" })
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Manage Sources</h1>

      {sources.length < 5 && (
        <Card className="mb-6">
          <CardContent className="space-y-4 pt-6">
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
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label>Current sources ({sources.length}/5)</Label>
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center gap-2 rounded-md border p-3"
          >
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {sourceTypes.find((t) => t.value === source.type)?.label}
            </span>
            <span className="flex-1 truncate text-sm">{source.url}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeSource(source.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No sources added yet.
          </p>
        )}
      </div>
    </div>
  )
}
