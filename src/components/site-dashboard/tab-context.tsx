"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Send,
  Loader2,
  Save,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  FileText,
  MessageSquare,
} from "lucide-react"
import type { SiteData } from "./site-dashboard"

interface TabContextProps {
  site: SiteData
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface PromptVersion {
  prompt: string
  summary: string
  created_at: string
}

export function TabContext({ site }: TabContextProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Prompt state
  const [prompt, setPrompt] = useState(site.writing_prompt || "")
  const [savedPrompt, setSavedPrompt] = useState(site.writing_prompt || "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Version history
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [showVersions, setShowVersions] = useState(false)

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

  // Send initial analysis when prompt exists and chat is empty
  useEffect(() => {
    if (savedPrompt && messages.length === 0 && !chatLoading) {
      sendAnalysis()
    }
  }, [savedPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, chatLoading])

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

  async function sendAnalysis() {
    setChatLoading(true)
    try {
      const res = await fetch("/api/ai/context-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          message: "Analyze my current writing prompt and suggest 2-3 specific improvements. Be concise.",
          currentPrompt: savedPrompt,
          chatHistory: [],
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setMessages([{ role: "assistant", content: data.reply }])
    } catch {
      setMessages([{
        role: "assistant",
        content: "I'm ready to help you improve your writing prompt. What would you like to change?",
      }])
    } finally {
      setChatLoading(false)
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

      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writing_prompt: prompt,
          context_files: { versions: updatedVersions },
        }),
      })
      if (!res.ok) throw new Error("Failed")
      setSavedPrompt(prompt)
      setVersions(updatedVersions)
      toast({ title: "Prompt saved" })
      router.refresh()
    } catch {
      toast({ title: "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      const userMsg: ChatMessage = { role: "user", content: content.trim() }
      const newHistory = [...messages, userMsg]
      setMessages(newHistory)
      setInput("")
      setChatLoading(true)

      try {
        const res = await fetch("/api/ai/context-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: site.id,
            message: content.trim(),
            currentPrompt: prompt,
            chatHistory: newHistory.slice(-10),
          }),
        })

        if (!res.ok) throw new Error("Chat failed")
        const data = await res.json()

        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])

        if (data.updatedPrompt) {
          setPrompt(data.updatedPrompt)
          setSavedPrompt(data.updatedPrompt)
          const newVersion: PromptVersion = {
            prompt: data.updatedPrompt,
            summary: data.changeSummary || "Updated via chat",
            created_at: new Date().toISOString(),
          }
          setVersions((prev) => [...prev, newVersion].slice(-20))
          router.refresh()
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ])
      } finally {
        setChatLoading(false)
        inputRef.current?.focus()
      }
    },
    [messages, prompt, site.id, router]
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleRevert(version: PromptVersion) {
    setPrompt(version.prompt)
    toast({ title: "Reverted — save to apply" })
  }

  const hasUnsavedChanges = prompt !== savedPrompt

  return (
    <div className="mt-8">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(340px,420px)]">
          {/* Left panel — Prompt Editor */}
          <div className="flex flex-col min-h-[640px]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Writing Prompt</span>
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Unsaved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!savedPrompt && site.topic && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateInitialPrompt}
                    disabled={generating}
                    className="h-8"
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Generate
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSavePrompt}
                  disabled={saving || !hasUnsavedChanges}
                  className="h-8"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            {/* Editor */}
            {generating ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Generating your writing prompt</p>
                    <p className="text-xs text-muted-foreground mt-1">Based on your site topic...</p>
                  </div>
                </div>
              </div>
            ) : (
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Your writing prompt will appear here. This is the instruction set the AI follows when generating blog posts for your site."
                className="flex-1 min-h-0 font-mono text-[13px] leading-[1.7] resize-none border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 p-5"
              />
            )}

            {/* Version history */}
            {versions.length > 0 && (
              <div className="border-t bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center gap-1.5 w-full px-5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Version history ({versions.length})
                  {showVersions ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                </button>
                {showVersions && (
                  <div className="px-3 pb-3 max-h-[160px] overflow-y-auto space-y-0.5">
                    {[...versions].reverse().map((v, i) => (
                      <div
                        key={versions.length - 1 - i}
                        className="group flex items-center justify-between text-xs py-1.5 px-2 rounded-md hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex-1 min-w-0 flex items-baseline gap-2">
                          <span className="font-mono text-muted-foreground">v{versions.length - i}</span>
                          <span className="truncate">{v.summary}</span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {new Date(v.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {v.prompt !== prompt && (
                          <button
                            type="button"
                            className="hidden group-hover:inline-flex items-center text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0"
                            onClick={() => handleRevert(v)}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel — Chat */}
          <div className="flex flex-col min-h-[640px] border-t lg:border-t-0 lg:border-l bg-muted/20">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/30">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Prompt Editor</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
              {messages.length === 0 && !chatLoading && !savedPrompt && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Bot className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Chat will start once your prompt is ready.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border shadow-sm"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div
                    className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground ml-8"
                        : "bg-background border shadow-sm mr-8"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border shadow-sm">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-xl px-3.5 py-2.5 bg-background border shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t bg-background/60">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask to improve your prompt..."
                  rows={1}
                  className="min-h-[40px] max-h-[100px] resize-none text-sm"
                  disabled={chatLoading || !savedPrompt}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={chatLoading || !input.trim() || !savedPrompt}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>
    </div>
  )
}
