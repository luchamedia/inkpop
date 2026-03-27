"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Sparkles, FileText, Eye, Pencil } from "lucide-react"
import { patchSite } from "@/lib/client-helpers"
import { PromptEditor } from "./prompt-editor"
import { PromptSectionBuilder } from "./prompt-section-builder"
import { PromptDiffView } from "./prompt-diff-view"
import { ContextVersionHistory, type PromptVersion } from "./context-version-history"
import type { SiteData } from "./site-dashboard"

interface TabContextProps {
  site: SiteData
}

export function TabContext({ site }: TabContextProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Prompt state
  const [prompt, setPrompt] = useState(site.writing_prompt || "")
  const [savedPrompt, setSavedPrompt] = useState(site.writing_prompt || "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // View mode: "edit" (rich editor) or "diff" (show changes)
  const [viewMode, setViewMode] = useState<"edit" | "diff">("edit")

  // Version history
  const [versions, setVersions] = useState<PromptVersion[]>([])

  // Load version history from context_files
  useEffect(() => {
    const meta = site.context_files as { versions?: PromptVersion[] } | null
    if (meta?.versions) {
      setVersions(meta.versions)
    }
  }, [site.context_files])

  // Auto-generate initial prompt if empty
  useEffect(() => {
    if (!site.writing_prompt && site.topic && !generating) {
      generateInitialPrompt()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateInitialPrompt() {
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-initial-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id }),
      })
      if (!res.ok) throw new Error("Failed to generate")
      const data = await res.json()
      setPrompt(data.prompt)
      setSavedPrompt(data.prompt)
      setVersions([{
        prompt: data.prompt,
        summary: "Initial prompt generated from site topic",
        created_at: new Date().toISOString(),
      }])
      router.refresh()
    } catch {
      toast({ title: "Failed to generate initial prompt", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  async function handleSavePrompt() {
    setSaving(true)
    try {
      const newVersion: PromptVersion = {
        prompt,
        summary: "Manual edit",
        created_at: new Date().toISOString(),
      }
      const updatedVersions = [...versions, newVersion].slice(-20)

      const res = await patchSite(site.id, {
        writing_prompt: prompt,
        context_files: { versions: updatedVersions },
      })
      if (!res.ok) throw new Error("Failed")
      setSavedPrompt(prompt)
      setVersions(updatedVersions)
      setViewMode("edit")
      toast({ title: "Prompt saved" })
      router.refresh()
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handlePromptUpdated = useCallback(
    (newPrompt: string, changeSummary: string) => {
      setPrompt(newPrompt)
      setSavedPrompt(newPrompt)
      setVersions((prev) => [...prev, {
        prompt: newPrompt,
        summary: changeSummary,
        created_at: new Date().toISOString(),
      }].slice(-20))
      router.refresh()
      toast({ title: changeSummary })
    },
    [router, toast]
  )

  // When prompt changes via section builder (auto-saved by API),
  // show diff view automatically
  const handleSectionPromptChange = useCallback(
    (newPrompt: string, changeSummary: string) => {
      // Store the pre-change prompt for diff
      const previousPrompt = prompt
      handlePromptUpdated(newPrompt, changeSummary)
      // If there was a previous prompt, show the diff
      if (previousPrompt.trim()) {
        setViewMode("diff")
      }
    },
    [prompt, handlePromptUpdated]
  )

  function handleRevert(version: PromptVersion) {
    setPrompt(version.prompt)
    toast({ title: "Reverted — save to apply" })
  }

  const hasUnsavedChanges = prompt !== savedPrompt

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-4">
      {/* Left — Prompt Editor */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Writing Prompt</span>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-700">
                Unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Diff / Edit toggle */}
            {prompt !== savedPrompt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode(viewMode === "diff" ? "edit" : "diff")}
                className="h-7 text-xs gap-1"
              >
                {viewMode === "diff" ? (
                  <><Pencil className="h-3 w-3" /> Edit</>
                ) : (
                  <><Eye className="h-3 w-3" /> Diff</>
                )}
              </Button>
            )}
            {!savedPrompt && site.topic && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateInitialPrompt}
                disabled={generating}
                className="h-7 text-xs"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Generate
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSavePrompt}
              disabled={saving || !hasUnsavedChanges}
              className="h-7 text-xs"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Editor / Diff / Loading */}
        {generating ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Generating your writing prompt</p>
              <p className="text-xs text-muted-foreground">Based on your site topic…</p>
            </div>
          </div>
        ) : viewMode === "diff" && savedPrompt !== prompt ? (
          <div className="min-h-[500px] overflow-y-auto">
            <PromptDiffView oldText={savedPrompt} newText={prompt} />
          </div>
        ) : (
          <div className="flex flex-col min-h-[500px]">
            <PromptEditor
              value={prompt}
              onChange={setPrompt}
              placeholder="Your writing prompt will appear here. This is the instruction set the AI follows when generating blog posts for your site."
            />
          </div>
        )}

        {/* Version history */}
        <ContextVersionHistory
          versions={versions}
          currentPrompt={prompt}
          onRevert={handleRevert}
        />
      </Card>

      {/* Right — Section Builder */}
      <div className="space-y-4">
        <PromptSectionBuilder
          prompt={prompt}
          savedPrompt={savedPrompt}
          siteId={site.id}
          onPromptUpdated={handleSectionPromptChange}
        />
      </div>
    </div>
  )
}
