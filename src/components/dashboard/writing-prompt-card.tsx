"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Pen, Check, X, Loader2, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WritingPromptCardProps {
  siteId: string
  writingPrompt: string | null
  writingPromptInputs: Record<string, unknown> | null
}

export function WritingPromptCard({ siteId, writingPrompt, writingPromptInputs: _inputs }: WritingPromptCardProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [prompt, setPrompt] = useState(writingPrompt || "")
  const [saving, setSaving] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(writingPrompt)
  const [copied, setCopied] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writing_prompt: prompt || null }),
      })

      if (!res.ok) throw new Error("Failed to save")

      setCurrentPrompt(prompt || null)
      setEditing(false)
      toast({ title: "Writing prompt saved" })
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!currentPrompt && !editing) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Writing prompt</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No custom writing prompt set — posts use the default AI writer.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pen className="h-3 w-3 mr-1.5" />
              Set up
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Writing prompt</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrompt(currentPrompt || "")
                  setEditing(false)
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={16}
            className="font-mono text-xs leading-relaxed"
            placeholder="Paste or write your custom writing prompt here..."
          />
          <p className="text-xs text-muted-foreground">
            This prompt is sent to the AI before every blog post generation. It controls tone, style, structure, and brand voice.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Display mode
  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Writing prompt</p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <><Check className="h-3 w-3 mr-1" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pen className="h-3 w-3 mr-1.5" />
              Edit
            </Button>
          </div>
        </div>
        <pre className="text-xs text-muted-foreground bg-muted/50 rounded-md p-4 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
          {currentPrompt?.slice(0, 500)}{(currentPrompt?.length || 0) > 500 ? "..." : ""}
        </pre>
      </CardContent>
    </Card>
  )
}
