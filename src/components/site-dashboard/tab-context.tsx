"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Sparkles, FileText } from "lucide-react"
import { patchSite } from "@/lib/client-helpers"
import { ContextChat, type ChatMessage } from "./context-chat"
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

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)

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

  // Send initial analysis when prompt exists and chat is empty
  useEffect(() => {
    if (savedPrompt && messages.length === 0 && !chatLoading) {
      sendAnalysis()
    }
  }, [savedPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

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

      const res = await patchSite(site.id, {
        writing_prompt: prompt,
        context_files: { versions: updatedVersions },
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
      }
    },
    [messages, prompt, site.id, router]
  )

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
            <ContextVersionHistory
              versions={versions}
              currentPrompt={prompt}
              onRevert={handleRevert}
            />
          </div>

          {/* Right panel — Chat */}
          <ContextChat
            siteId={site.id}
            messages={messages}
            chatLoading={chatLoading}
            savedPrompt={savedPrompt}
            currentPrompt={prompt}
            input={input}
            onInputChange={setInput}
            onSendMessage={sendMessage}
          />
        </div>
      </Card>
    </div>
  )
}
