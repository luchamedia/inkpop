"use client"

import { useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Bot, User, MessageSquare } from "lucide-react"

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
    (e: React.FormEvent<HTMLFormElement>) => {
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
            onChange={(e) => onInputChange(e.target.value)}
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
  )
}
