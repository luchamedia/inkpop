"use client"

import { useMemo } from "react"
import { diffWords } from "diff"

interface PromptDiffViewProps {
  oldText: string
  newText: string
}

export function PromptDiffView({ oldText, newText }: PromptDiffViewProps) {
  const changes = useMemo(
    () => diffWords(oldText, newText),
    [oldText, newText]
  )

  if (oldText === newText) return null

  return (
    <div className="prompt-diff-view text-[13px] leading-[1.7] whitespace-pre-wrap p-5">
      {changes.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="diff-added">
              {part.value}
            </span>
          )
        }
        if (part.removed) {
          return (
            <span key={i} className="diff-removed">
              {part.value}
            </span>
          )
        }
        return <span key={i}>{part.value}</span>
      })}
    </div>
  )
}
