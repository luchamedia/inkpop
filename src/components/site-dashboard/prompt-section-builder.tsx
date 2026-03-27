"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  Users,
  MessageCircle,
  LayoutList,
  Layers,
  Search,
  ShieldCheck,
  Check,
  Plus,
  ArrowUp,
  Loader2,
  PenTool,
  type LucideIcon,
} from "lucide-react"
import {
  SUGGESTED_SECTIONS,
  detectExistingSections,
  getSectionContent,
  type SuggestedSection,
} from "@/lib/prompt-sections"
import { SectionDialog } from "./section-dialog"

const SECTION_ICONS: Record<string, LucideIcon> = {
  topic: FileText,
  audience: Users,
  voice: MessageCircle,
  structure: LayoutList,
  "content-types": Layers,
  seo: Search,
  rules: ShieldCheck,
}

interface PromptSectionBuilderProps {
  prompt: string
  savedPrompt: string
  siteId: string
  onPromptUpdated: (newPrompt: string, changeSummary: string) => void
}

export function PromptSectionBuilder({
  prompt,
  savedPrompt,
  siteId,
  onPromptUpdated,
}: PromptSectionBuilderProps) {
  const { toast } = useToast()

  // Section dialog state
  const [activeSection, setActiveSection] = useState<SuggestedSection | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Custom section dialog
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [customName, setCustomName] = useState("")

  // Ask AI state
  const [askInput, setAskInput] = useState("")
  const [askLoading, setAskLoading] = useState(false)

  const existingSections = useMemo(
    () => detectExistingSections(prompt),
    [prompt]
  )

  function handleSectionClick(section: SuggestedSection) {
    setActiveSection(section)
    setDialogOpen(true)
  }

  function handleCustomClick() {
    setCustomName("")
    setCustomDialogOpen(true)
  }

  function handleCustomSubmit() {
    if (!customName.trim()) return
    const customSection: SuggestedSection = {
      id: `custom-${Date.now()}`,
      heading: customName.trim(),
      description: "Custom section",
      questions: [
        {
          id: "content",
          label: `What should the "${customName.trim()}" section cover?`,
          type: "text",
          placeholder: "Describe what you want in this section…",
        },
      ],
      matchKeywords: [],
      isCustom: true,
    }
    setCustomDialogOpen(false)
    setActiveSection(customSection)
    setDialogOpen(true)
  }

  const handlePromptUpdated = useCallback(
    (newPrompt: string, changeSummary: string) => {
      onPromptUpdated(newPrompt, changeSummary)
    },
    [onPromptUpdated]
  )

  async function handleAskAI() {
    if (!askInput.trim()) return

    setAskLoading(true)
    try {
      const res = await fetch("/api/ai/context-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          message: askInput.trim(),
          currentPrompt: prompt,
          chatHistory: [],
        }),
      })

      if (!res.ok) throw new Error("Failed")
      const data = await res.json()

      if (data.updatedPrompt) {
        onPromptUpdated(
          data.updatedPrompt,
          data.changeSummary || "Updated via AI"
        )
      } else if (data.reply) {
        toast({ title: "AI Response", description: data.reply })
      }

      setAskInput("")
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" })
    } finally {
      setAskLoading(false)
    }
  }

  const existingContent = activeSection
    ? getSectionContent(prompt, activeSection.id)
    : null

  return (
    <>
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/30">
          <span className="text-sm font-medium">Sections</span>
        </div>

        <div className="p-3">
          {/* 3-wide section card grid */}
          <div className="grid grid-cols-1 gap-1.5">
            {SUGGESTED_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.id] || FileText
              const exists = existingSections.has(section.id)
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionClick(section)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-muted/50 group"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-[13px] font-medium flex-1 truncate">
                    {section.heading}
                  </span>
                  {exists ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              )
            })}

            {/* Custom section button */}
            <button
              type="button"
              onClick={handleCustomClick}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-muted/50 group"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted border border-dashed border-muted-foreground/30">
                <PenTool className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-[13px] font-medium text-muted-foreground flex-1">
                Custom section
              </span>
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </Card>

      {/* Ask AI freeform input */}
      {savedPrompt && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30">
            <span className="text-sm font-medium">Ask AI</span>
          </div>
          <div className="p-3">
            <div className="relative">
              <Textarea
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAskAI()
                  }
                }}
                placeholder="Make the tone more casual…"
                rows={2}
                className="min-h-[60px] max-h-[100px] resize-none text-[13px] pr-10"
                disabled={askLoading}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-1 bottom-1 h-7 w-7"
                disabled={askLoading || !askInput.trim()}
                onClick={handleAskAI}
              >
                {askLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Custom section name dialog */}
      {customDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-background rounded-lg border p-6 w-full max-w-sm shadow-lg space-y-4">
            <div>
              <h3 className="text-base font-semibold">New Custom Section</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Name your section — you&apos;ll describe what goes in it next.
              </p>
            </div>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSubmit()
              }}
              placeholder="e.g., Brand Guidelines, Link Strategy…"
              className="w-full rounded-md border px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomSubmit}
                disabled={!customName.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      <SectionDialog
        section={activeSection}
        existingContent={existingContent}
        currentPrompt={prompt}
        siteId={siteId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPromptUpdated={handlePromptUpdated}
      />
    </>
  )
}
