"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MessageSquare,
  Globe,
  ArrowRight,
  Loader2,
  Send,
} from "lucide-react"

interface TopicBrief {
  description: string
  audience: string
  contentGoals: string
}

interface TopicData {
  topic: string
  topicContext: Array<{ question: string; answer: string }>
  description: string
  companyUrl?: string
}

interface StepTopicProps {
  data: TopicData
  onNext: (data: TopicData) => void
}

type Path = null | "topic" | "company"
type Phase = "choose" | "input" | "generating" | "brief" | "scanning" | "review"

export function StepTopic({ data, onNext }: StepTopicProps) {
  const [path, setPath] = useState<Path>(data.topic ? "topic" : null)
  const [phase, setPhase] = useState<Phase>(data.topic ? "brief" : "choose")

  // Path A state
  const [topic, setTopic] = useState(data.topic)
  const [brief, setBrief] = useState<TopicBrief>({
    description: data.description,
    audience:
      data.topicContext.find((c) => c.question === "Audience")?.answer || "",
    contentGoals:
      data.topicContext.find((c) => c.question === "Content Goals")?.answer ||
      "",
  })
  const [refineInput, setRefineInput] = useState("")
  const [refining, setRefining] = useState(false)

  // Path B state
  const [companyUrl, setCompanyUrl] = useState(data.companyUrl || "")
  const [scanResult, setScanResult] = useState<{
    companyName: string
    description: string
    audience: string
    suggestedTopic: string
    keywords: string[]
  } | null>(null)

  // --- Path A: Generate brief ---

  async function handleGenerateBrief() {
    if (!topic.trim()) return
    setPhase("generating")
    try {
      const res = await fetch("/api/ai/topic-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      const data = await res.json()
      if (data.brief) {
        setBrief(data.brief)
      }
      setPhase("brief")
    } catch {
      setBrief({
        description: `A blog about ${topic}.`,
        audience: "People interested in this topic.",
        contentGoals: "Informative articles and guides.",
      })
      setPhase("brief")
    }
  }

  async function handleRefine() {
    if (!refineInput.trim()) return
    setRefining(true)
    try {
      const res = await fetch("/api/ai/topic-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, instruction: refineInput.trim() }),
      })
      const data = await res.json()
      if (data.brief) {
        setBrief(data.brief)
      }
      setRefineInput("")
    } catch {
      // Keep current brief on error
    } finally {
      setRefining(false)
    }
  }

  // --- Path B: Company scan ---

  async function handleCompanyScan() {
    if (!companyUrl.trim()) return
    setPhase("scanning")
    try {
      const res = await fetch("/api/ai/scan-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: companyUrl.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Scan failed")
      }
      const result = await res.json()
      setScanResult(result)
      setTopic(result.suggestedTopic || "")
      setBrief({
        description: result.description || "",
        audience: result.audience || "",
        contentGoals: "",
      })
      setPhase("review")
    } catch {
      setPhase("input")
    }
  }

  // --- Continue ---

  function handleContinue() {
    const topicContext =
      path === "company" && scanResult
        ? [
            { question: "Company", answer: scanResult.companyName },
            { question: "Audience", answer: brief.audience },
            { question: "Content Goals", answer: brief.contentGoals },
            { question: "Keywords", answer: scanResult.keywords.join(", ") },
          ]
        : [
            { question: "Audience", answer: brief.audience },
            { question: "Content Goals", answer: brief.contentGoals },
          ]

    onNext({
      topic: topic.trim(),
      topicContext,
      description: brief.description.trim(),
      companyUrl: path === "company" ? companyUrl : undefined,
    })
  }

  // --- Render ---

  if (phase === "choose") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Define your topic</h2>
          <p className="text-sm text-muted-foreground">
            Help our AI understand what your blog is about.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => {
              setPath("topic")
              setPhase("input")
            }}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">I have a topic in mind</p>
                <p className="text-sm text-muted-foreground">
                  Tell us what your blog is about
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => {
              setPath("company")
              setPhase("input")
            }}
          >
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <Globe className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">I have a company website</p>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll scan it and suggest a topic
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (phase === "input" && path === "topic") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">What is your blog about?</h2>
          <p className="text-sm text-muted-foreground">
            Describe your topic in a few words. Our AI will generate a detailed
            brief you can edit.
          </p>
        </div>

        <Textarea
          placeholder="e.g., Sustainable living tips for urban millennials..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={500}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">
          {topic.length}/500
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setPath(null)
              setPhase("choose")
            }}
          >
            Back
          </Button>
          <Button onClick={handleGenerateBrief} disabled={!topic.trim()}>
            Generate Brief
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "input" && path === "company") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Enter your website URL</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll scan your website and suggest a blog topic based on what
            you do.
          </p>
        </div>

        <Input
          placeholder="https://yourcompany.com"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
        />

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setPath(null)
              setPhase("choose")
            }}
          >
            Back
          </Button>
          <Button onClick={handleCompanyScan} disabled={!companyUrl.trim()}>
            Scan Website
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "generating" || phase === "scanning") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            {phase === "generating"
              ? "Generating your brief..."
              : "Scanning your website..."}
          </h2>
          <p className="text-sm text-muted-foreground">
            This usually takes 10-15 seconds.
          </p>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
    )
  }

  // Shared brief editor for both Path A (after generate) and Path B (after scan)
  if (phase === "brief" || phase === "review") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            {phase === "review" ? "Here's what we found" : "Your blog brief"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Edit any field directly, or ask AI to make changes below.
          </p>
        </div>

        {phase === "review" && scanResult && (
          <div className="rounded-lg border bg-muted/50 px-4 py-3">
            <p className="text-sm">
              <span className="font-medium">Detected:</span>{" "}
              {scanResult.companyName}
            </p>
          </div>
        )}

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Your blog topic"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={brief.description}
                onChange={(e) =>
                  setBrief((b) => ({ ...b, description: e.target.value }))
                }
                rows={3}
                placeholder="What does your blog cover?"
              />
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Textarea
                value={brief.audience}
                onChange={(e) =>
                  setBrief((b) => ({ ...b, audience: e.target.value }))
                }
                rows={2}
                placeholder="Who are you writing for?"
              />
            </div>

            <div className="space-y-2">
              <Label>Content Goals</Label>
              <Textarea
                value={brief.contentGoals}
                onChange={(e) =>
                  setBrief((b) => ({ ...b, contentGoals: e.target.value }))
                }
                rows={2}
                placeholder="What type of content will you create?"
              />
            </div>
          </CardContent>
        </Card>

        {/* AI refine input */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Ask AI to make changes
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Make it more focused on beginners..."
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !refining) handleRefine()
              }}
              disabled={refining}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefine}
              disabled={!refineInput.trim() || refining}
            >
              {refining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPhase("input")}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={!topic.trim()}>
            Looks good, continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}
