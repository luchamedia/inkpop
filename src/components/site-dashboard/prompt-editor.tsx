"use client"

import { useEffect, useRef } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import { PromptToolbar } from "./prompt-toolbar"

// tiptap-markdown adds `storage.markdown` dynamically at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMarkdown(editor: { storage: any }): string {
  return editor.storage.markdown.getMarkdown()
}

interface PromptEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  disabled?: boolean
}

export function PromptEditor({
  value,
  onChange,
  placeholder = "Start writing your prompt...",
  disabled = false,
}: PromptEditorProps) {
  // Guard ref to prevent feedback loops when syncing external changes
  const skipNextUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false
        return
      }
      const md = getMarkdown(editor)
      onChange(md)
    },
    immediatelyRender: true,
  })

  // Sync external value changes (AI chat updates, version revert) into the editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const currentMd = getMarkdown(editor)
    if (value !== currentMd) {
      skipNextUpdate.current = true
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // Sync disabled/editable state
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PromptToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="flex-1 min-h-0 overflow-y-auto prompt-editor-content"
      />
    </div>
  )
}
