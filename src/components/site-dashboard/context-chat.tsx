"use client"

import { useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, Loader2, Sparkles } from "lucide-react"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ContextChatProps {
  siteId: string
  messages: ChatMessage[]
  chatLoading: boolean
  savedPrompt: string
  currentPrompt: string
  input: string
  onInputChange: (value: string) => void
  onSendMessage: (content: string) => void
}

export function ContextChat({
  messages,
  chatLoading,
  savedPrompt,
  input,
  onInputChange,
  onSendMessage,
}: ContextChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, chatLoading])

  useEffect(() => {
    if (!chatLoading) inputRef.current?.focus()
  }, [chatLoading])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSendMessage(input)
    },
    [input, onSendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSendMessage(input)
      }
    },
    [input, onSendMessage]
  )

  return (
    <div className="flex flex-col border-t lg:border-t-0 lg:border-l bg-muted/15">
      {/* Header — matches left panel header exactly */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Suggestions</span>
      </div>

      {/* Messages — styled as a comment/annotation thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !chatLoading && !savedPrompt && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Save your prompt to get AI suggestions for improving it.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "px-4 py-2.5 border-b bg-muted/30"
                : "px-4 py-3 border-b"
            }
          >
            {msg.role === "user" && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                You
              </span>
            )}
            <p className="text-[13px] leading-[1.65] text-foreground whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}

        {chatLoading && (
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Analyzing prompt…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input — inline comment style */}
      <form onSubmit={handleSubmit} className="p-3 border-t mt-auto">
        <div className="relative">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for changes…"
            rows={1}
            className="min-h-[36px] max-h-[80px] resize-none text-[13px] pr-10"
            disabled={chatLoading || !savedPrompt}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute right-1 bottom-1 h-7 w-7"
            disabled={chatLoading || !input.trim() || !savedPrompt}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </div>
  )
}
