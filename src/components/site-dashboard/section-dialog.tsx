"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Check } from "lucide-react"
import {
  buildAnswerSummary,
  type SuggestedSection,
  type SectionQuestion,
} from "@/lib/prompt-sections"

interface SectionDialogProps {
  section: SuggestedSection | null
  existingContent: string | null
  currentPrompt: string
  siteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPromptUpdated: (newPrompt: string, changeSummary: string) => void
}

export function SectionDialog({
  section,
  existingContent,
  currentPrompt,
  siteId,
  open,
  onOpenChange,
  onPromptUpdated,
}: SectionDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setAnswers({})
      setError(false)
    }
  }, [open, section?.id])

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function toggleChoice(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = prev[questionId] || ""
      // For choice questions, just set the single value
      return { ...prev, [questionId]: current === option ? "" : option }
    })
  }

  const hasAnyAnswers = Object.values(answers).some((v) => v.trim())

  async function handleGenerate() {
    if (!section || !hasAnyAnswers) return

    setLoading(true)
    setError(false)
    try {
      const action = existingContent ? "Update" : "Add"
      const summary = buildAnswerSummary(section, answers)

      const message = `${action} the '${section.heading}' section of the writing prompt.

The user answered these questions about their preferences:

${summary}

IMPORTANT: The generated section MUST follow this exact format:
1. Start with a detailed, action-oriented paragraph providing high-level instructions for this section
2. Follow with a bulleted list of specific, concrete instructions

Return the full updated prompt with this section ${existingContent ? "rewritten" : "added"}.`

      const res = await fetch("/api/ai/context-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          message,
          currentPrompt,
          chatHistory: [],
        }),
      })

      if (!res.ok) throw new Error("Failed")
      const data = await res.json()

      if (data.updatedPrompt) {
        onPromptUpdated(
          data.updatedPrompt,
          data.changeSummary || `${action}ed ${section.heading}`
        )
        onOpenChange(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (!section) return null

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-muted" />
              <Loader2 className="h-10 w-10 animate-spin text-foreground absolute inset-0" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                Writing your {section.heading.toLowerCase()} section
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This takes a few seconds…
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">
                {existingContent ? "Update" : "Set up"}: {section.heading}
              </DialogTitle>
              <DialogDescription>
                {section.description}. Answer what applies — skip the rest.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-1">
              {section.questions.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id] || ""}
                  onChange={(v) => setAnswer(q.id, v)}
                  onToggle={(opt) => toggleChoice(q.id, opt)}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-destructive">
                Something went wrong. Try again.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={!hasAnyAnswers}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {existingContent ? "Update Section" : "Generate Section"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function QuestionField({
  question,
  value,
  onChange,
  onToggle,
}: {
  question: SectionQuestion
  value: string
  onChange: (v: string) => void
  onToggle: (option: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{question.label}</label>

      {question.type === "choice" && question.options ? (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((opt) => {
            const selected = value === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {selected && <Check className="h-3 w-3" />}
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={2}
          className="text-[13px] resize-none"
        />
      )}
    </div>
  )
}
