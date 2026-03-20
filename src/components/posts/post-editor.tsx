"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface PostEditorProps {
  post: {
    id: string
    title: string
    body: string
    meta_description: string | null
    status: string
  }
}

export function PostEditor({ post }: PostEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState(post.title)
  const [body, setBody] = useState(post.body)
  const [metaDescription, setMetaDescription] = useState(
    post.meta_description || ""
  )
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          meta_description: metaDescription,
        }),
      })

      if (res.ok) {
        toast({ title: "Saved" })
        router.refresh()
      } else {
        toast({ title: "Error saving", variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      // Save first
      await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          meta_description: metaDescription,
        }),
      })

      const res = await fetch(`/api/posts/${post.id}/publish`, {
        method: "POST",
      })

      if (res.ok) {
        toast({ title: "Published" })
        router.refresh()
      } else {
        toast({ title: "Error publishing", variant: "destructive" })
      }
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta">Meta description</Label>
        <Input
          id="meta"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Brief description for SEO..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Content</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} variant="outline">
          {saving ? "Saving..." : "Save draft"}
        </Button>
        {post.status === "draft" && (
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing..." : "Approve & Publish"}
          </Button>
        )}
      </div>
    </div>
  )
}
