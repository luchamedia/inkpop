"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react"

export interface PromptVersion {
  prompt: string
  summary: string
  created_at: string
}

interface ContextVersionHistoryProps {
  versions: PromptVersion[]
  currentPrompt: string
  onRevert: (version: PromptVersion) => void
}

export function ContextVersionHistory({ versions, currentPrompt, onRevert }: ContextVersionHistoryProps) {
  const [showVersions, setShowVersions] = useState(false)

  if (versions.length === 0) return null

  return (
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
              {v.prompt !== currentPrompt && (
                <button
                  type="button"
                  className="hidden group-hover:inline-flex items-center text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0"
                  onClick={() => onRevert(v)}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
