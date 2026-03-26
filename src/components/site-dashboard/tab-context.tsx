"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { WritingPromptCard } from "@/components/dashboard/writing-prompt-card"
import { SourceManager } from "./source-manager"
import type { SiteData } from "./site-dashboard"

interface TabContextProps {
  site: SiteData
}

export function TabContext({ site }: TabContextProps) {
  return (
    <div className="mt-6 space-y-6">
      <BlogInfoSection site={site} />
      <SourceManager siteId={site.id} initialSources={site.sources} topic={site.topic} />
      <div>
        <h3 className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Writing Style
        </h3>
        <WritingPromptCard
          siteId={site.id}
          writingPrompt={site.writing_prompt}
          writingPromptInputs={site.writing_prompt_inputs}
        />
      </div>
    </div>
  )
}

function BlogInfoSection({ site }: { site: SiteData }) {
  const router = useRouter()
  const { toast } = useToast()
  const [topic, setTopic] = useState(site.topic || "")
  const [description, setDescription] = useState(site.description || "")
  const [category, setCategory] = useState(site.category || "")
  const [saving, setSaving] = useState(false)

  const hasChanges =
    topic !== (site.topic || "") ||
    description !== (site.description || "") ||
    category !== (site.category || "")

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, description, category }),
      })
      if (res.ok) {
        toast({ title: "Blog info updated" })
        router.refresh()
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error || "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update blog info", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Blog Info
      </h3>
      <div className="space-y-4">
        <div>
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            placeholder="What is your blog about?"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="A brief description of your blog"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g. Technology, Marketing, Health"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save blog info
          </Button>
        )}
      </div>
    </div>
  )
}
