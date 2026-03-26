"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, ChevronDown, ChevronUp, Plus, X, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WritingPromptInputs } from "@/lib/writing-prompt"

interface StepStyleProps {
  inputs: WritingPromptInputs
  writingPrompt: string
  description?: string
  topic?: string
  onNext: (inputs: WritingPromptInputs, writingPrompt: string) => void
  onBack: () => void
}

const VOICE_PRESETS = [
  "Direct", "Warm", "Authoritative", "Witty", "Playful",
  "Formal", "Conversational", "Technical", "Empathetic", "Bold",
]

const AVOID_PRESETS = [
  "Salesy", "Robotic", "Jargon-heavy", "Overly casual",
  "Condescending", "Vague", "Sensationalist", "Preachy",
]

const KNOWLEDGE_OPTIONS = [
  { value: "beginners", label: "Beginners" },
  { value: "familiar", label: "Familiar" },
  { value: "knowledgeable", label: "Knowledgeable" },
  { value: "experts", label: "Experts" },
]

const HUMOR_OPTIONS = [
  { value: "none", label: "No humor" },
  { value: "light", label: "Light / occasional" },
  { value: "core", label: "Humor is core" },
]

const FORMALITY_LABELS = ["Very casual", "Casual", "Balanced", "Formal", "Very formal"]

type Phase = "form" | "generating" | "preview"

export function StepStyle({ inputs: initialInputs, writingPrompt: initialPrompt, description, topic, onNext, onBack }: StepStyleProps) {
  const [phase, setPhase] = useState<Phase>(initialPrompt ? "preview" : "form")
  const [inputs, setInputs] = useState<WritingPromptInputs>({
    companyName: "",
    whatYouDo: description || "",
    industry: topic || "",
    formality: 3,
    voiceTraits: [],
    voiceAvoid: [],
    ...initialInputs,
  })
  const [prompt, setPrompt] = useState(initialPrompt)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Collapsible sections
  const [showLanguage, setShowLanguage] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  // Custom tag input
  const [customVoice, setCustomVoice] = useState("")
  const [customAvoid, setCustomAvoid] = useState("")

  function update<K extends keyof WritingPromptInputs>(key: K, value: WritingPromptInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  function toggleTag(key: "voiceTraits" | "voiceAvoid", tag: string, max?: number) {
    setInputs((prev) => {
      const current = prev[key] || []
      if (current.includes(tag)) {
        return { ...prev, [key]: current.filter((t) => t !== tag) }
      }
      if (max && current.length >= max) return prev
      return { ...prev, [key]: [...current, tag] }
    })
  }

  function addCustomTag(key: "voiceTraits" | "voiceAvoid", value: string, max?: number) {
    const trimmed = value.trim()
    if (!trimmed) return
    const current = inputs[key] || []
    if (current.includes(trimmed)) return
    if (max && current.length >= max) return
    update(key, [...current, trimmed])
  }

  const canGenerate = inputs.companyName?.trim() && inputs.whatYouDo?.trim() && (inputs.voiceTraits?.length || 0) >= 1

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setPhase("generating")

    try {
      const res = await fetch("/api/ai/generate-writing-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate writing prompt")
      }

      const data = await res.json()
      setPrompt(data.prompt)
      setPhase("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setPhase("form")
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- FORM PHASE ---
  if (phase === "form" || phase === "generating") {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold">Writing style</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us about your brand so we can generate a custom writing prompt for your AI blog writer.
          </p>
        </div>

        {/* Section A: Company Info */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">About your company</h3>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name *</Label>
            <Input
              id="companyName"
              value={inputs.companyName || ""}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatYouDo">What does your company do? *</Label>
            <Textarea
              id="whatYouDo"
              value={inputs.whatYouDo || ""}
              onChange={(e) => update("whatYouDo", e.target.value)}
              placeholder="1-2 sentences about what your company does"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={inputs.industry || ""}
              onChange={(e) => update("industry", e.target.value)}
              placeholder="e.g. SaaS, Healthcare, E-commerce"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="differentiator">What makes you different?</Label>
            <Textarea
              id="differentiator"
              value={inputs.differentiator || ""}
              onChange={(e) => update("differentiator", e.target.value)}
              placeholder="What sets you apart from competitors?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avoidTopics">Topics or competitors to never mention</Label>
            <Textarea
              id="avoidTopics"
              value={inputs.avoidTopics || ""}
              onChange={(e) => update("avoidTopics", e.target.value)}
              placeholder="e.g. Never mention CompetitorX, avoid claims about being #1"
              rows={2}
            />
          </div>
        </section>

        {/* Section B: Audience */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Target audience</h3>

          <div className="space-y-2">
            <Label htmlFor="audienceRole">Who reads your blog?</Label>
            <Input
              id="audienceRole"
              value={inputs.audienceRole || ""}
              onChange={(e) => update("audienceRole", e.target.value)}
              placeholder="e.g. Marketing managers, startup founders"
            />
          </div>

          <div className="space-y-2">
            <Label>How familiar are they with your space?</Label>
            <div className="flex flex-wrap gap-2">
              {KNOWLEDGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("audienceKnowledge", opt.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-colors",
                    inputs.audienceKnowledge === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audienceProblems">What problems are they solving?</Label>
            <Textarea
              id="audienceProblems"
              value={inputs.audienceProblems || ""}
              onChange={(e) => update("audienceProblems", e.target.value)}
              placeholder="What challenges bring them to your blog?"
              rows={2}
            />
          </div>
        </section>

        {/* Section C: Voice & Tone */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Voice & tone</h3>

          <div className="space-y-2">
            <Label>Pick 1-5 words that describe your brand voice *</Label>
            <div className="flex flex-wrap gap-2">
              {VOICE_PRESETS.map((trait) => (
                <button
                  key={trait}
                  type="button"
                  onClick={() => toggleTag("voiceTraits", trait, 5)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-colors",
                    (inputs.voiceTraits || []).includes(trait)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  )}
                >
                  {trait}
                </button>
              ))}
              {/* Custom entries */}
              {(inputs.voiceTraits || [])
                .filter((t) => !VOICE_PRESETS.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag("voiceTraits", t)}
                    className="px-3 py-1.5 text-sm rounded-full border bg-primary text-primary-foreground border-primary flex items-center gap-1"
                  >
                    {t}
                    <X className="h-3 w-3" />
                  </button>
                ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={customVoice}
                onChange={(e) => setCustomVoice(e.target.value)}
                placeholder="Add custom..."
                className="max-w-48"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustomTag("voiceTraits", customVoice, 5)
                    setCustomVoice("")
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  addCustomTag("voiceTraits", customVoice, 5)
                  setCustomVoice("")
                }}
                disabled={!customVoice.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {(inputs.voiceTraits || []).length}/5 selected
            </p>
          </div>

          <div className="space-y-2">
            <Label>Your voice is NOT...</Label>
            <div className="flex flex-wrap gap-2">
              {AVOID_PRESETS.map((trait) => (
                <button
                  key={trait}
                  type="button"
                  onClick={() => toggleTag("voiceAvoid", trait)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-colors",
                    (inputs.voiceAvoid || []).includes(trait)
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : "bg-background text-foreground border-border hover:border-destructive/50"
                  )}
                >
                  {trait}
                </button>
              ))}
              {(inputs.voiceAvoid || [])
                .filter((t) => !AVOID_PRESETS.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag("voiceAvoid", t)}
                    className="px-3 py-1.5 text-sm rounded-full border bg-destructive/15 text-destructive border-destructive/30 flex items-center gap-1"
                  >
                    {t}
                    <X className="h-3 w-3" />
                  </button>
                ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={customAvoid}
                onChange={(e) => setCustomAvoid(e.target.value)}
                placeholder="Add custom..."
                className="max-w-48"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustomTag("voiceAvoid", customAvoid)
                    setCustomAvoid("")
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  addCustomTag("voiceAvoid", customAvoid)
                  setCustomAvoid("")
                }}
                disabled={!customAvoid.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>How formal is your tone?</Label>
            <input
              type="range"
              min={1}
              max={5}
              value={inputs.formality || 3}
              onChange={(e) => update("formality", Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {FORMALITY_LABELS.map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    (inputs.formality || 3) === i + 1 && "text-foreground font-medium"
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Do you use humor?</Label>
            <div className="flex flex-wrap gap-2">
              {HUMOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("humor", opt.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-colors",
                    inputs.humor === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hardRules">Any hard style rules?</Label>
            <Textarea
              id="hardRules"
              value={inputs.hardRules || ""}
              onChange={(e) => update("hardRules", e.target.value)}
              placeholder="e.g. Always use Oxford comma, no exclamation points, avoid passive voice"
              rows={2}
            />
          </div>
        </section>

        {/* Section D: Language Rules (collapsible) */}
        <section>
          <button
            type="button"
            onClick={() => setShowLanguage(!showLanguage)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            Language rules
            {showLanguage ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showLanguage && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bannedPhrases">Words or phrases to never use</Label>
                <Textarea
                  id="bannedPhrases"
                  value={inputs.bannedPhrases || ""}
                  onChange={(e) => update("bannedPhrases", e.target.value)}
                  placeholder="One per line"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredJargon">Industry terms to use</Label>
                <Textarea
                  id="preferredJargon"
                  value={inputs.preferredJargon || ""}
                  onChange={(e) => update("preferredJargon", e.target.value)}
                  placeholder="Terms your audience expects"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avoidedJargon">Jargon to avoid</Label>
                <Textarea
                  id="avoidedJargon"
                  value={inputs.avoidedJargon || ""}
                  onChange={(e) => update("avoidedJargon", e.target.value)}
                  placeholder="Overly technical terms to skip"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerWord">What do you call your customers?</Label>
                <Input
                  id="customerWord"
                  value={inputs.customerWord || ""}
                  onChange={(e) => update("customerWord", e.target.value)}
                  placeholder="e.g. users, clients, members, customers"
                />
              </div>
            </div>
          )}
        </section>

        {/* Section E: Examples (collapsible) */}
        <section>
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            Examples & references
            {showExamples ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showExamples && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="goodExamples">Content you love (links or excerpts)</Label>
                <Textarea
                  id="goodExamples"
                  value={inputs.goodExamples || ""}
                  onChange={(e) => update("goodExamples", e.target.value)}
                  placeholder="2-3 examples of writing you want to emulate"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badExamples">Content you don&apos;t want</Label>
                <Textarea
                  id="badExamples"
                  value={inputs.badExamples || ""}
                  onChange={(e) => update("badExamples", e.target.value)}
                  placeholder="Examples of what to avoid"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admiredWriter">Writer or brand whose style you admire</Label>
                <Input
                  id="admiredWriter"
                  value={inputs.admiredWriter || ""}
                  onChange={(e) => update("admiredWriter", e.target.value)}
                  placeholder="e.g. Stripe's blog, Paul Graham, Seth Godin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Anything else the AI should know</Label>
                <Textarea
                  id="additionalNotes"
                  value={inputs.additionalNotes || ""}
                  onChange={(e) => update("additionalNotes", e.target.value)}
                  placeholder="Any other context for the AI writer"
                  rows={2}
                />
              </div>
            </div>
          )}
        </section>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNext({}, "")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip this step
            </button>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate writing prompt"
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // --- PREVIEW PHASE ---
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your writing prompt</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This prompt will guide your AI blog writer. You can edit it directly or regenerate.
        </p>
      </div>

      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={20}
          className="font-mono text-xs leading-relaxed"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="absolute top-2 right-2"
        >
          {copied ? (
            <><Check className="h-3 w-3 mr-1" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3 mr-1" /> Copy</>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={() => setPhase("form")}>
          Back to form
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Regenerating...
              </>
            ) : (
              "Regenerate"
            )}
          </Button>
          <Button onClick={() => onNext(inputs, prompt)}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
