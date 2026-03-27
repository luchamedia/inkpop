"use client"

import type { Editor } from "@tiptap/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PromptToolbarProps {
  editor: Editor | null
}

// Tiptap v3 registers chain commands dynamically from StarterKit extensions.
// We cast the chain to `any` once here so toolbar definitions stay clean.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChain = any

interface ToolbarItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  action: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
}

const formatGroup: ToolbarItem[] = [
  {
    icon: Bold,
    label: "Bold",
    action: (e) => (e.chain().focus() as AnyChain).toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
  },
  {
    icon: Italic,
    label: "Italic",
    action: (e) => (e.chain().focus() as AnyChain).toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
  },
]

const headingGroup: ToolbarItem[] = [
  {
    icon: Heading2,
    label: "Heading 2",
    action: (e) => (e.chain().focus() as AnyChain).toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    icon: Heading3,
    label: "Heading 3",
    action: (e) => (e.chain().focus() as AnyChain).toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
  },
]

const listGroup: ToolbarItem[] = [
  {
    icon: List,
    label: "Bullet list",
    action: (e) => (e.chain().focus() as AnyChain).toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
  },
  {
    icon: ListOrdered,
    label: "Numbered list",
    action: (e) => (e.chain().focus() as AnyChain).toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
  },
]

const historyGroup: ToolbarItem[] = [
  {
    icon: Undo2,
    label: "Undo",
    action: (e) => (e.chain().focus() as AnyChain).undo().run(),
  },
  {
    icon: Redo2,
    label: "Redo",
    action: (e) => (e.chain().focus() as AnyChain).redo().run(),
  },
]

function ToolbarButton({
  editor,
  item,
}: {
  editor: Editor
  item: ToolbarItem
}) {
  const active = item.isActive?.(editor) ?? false

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 rounded-sm",
        active && "bg-accent text-accent-foreground"
      )}
      onClick={() => item.action(editor)}
      title={item.label}
    >
      <item.icon className="h-3.5 w-3.5" />
    </Button>
  )
}

function ToolbarGroup({
  editor,
  items,
}: {
  editor: Editor
  items: ToolbarItem[]
}) {
  return (
    <div className="flex items-center gap-0.5">
      {items.map((item) => (
        <ToolbarButton key={item.label} editor={editor} item={item} />
      ))}
    </div>
  )
}

export function PromptToolbar({ editor }: PromptToolbarProps) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b">
      <ToolbarGroup editor={editor} items={formatGroup} />
      <Separator orientation="vertical" className="h-4 mx-1" />
      <ToolbarGroup editor={editor} items={headingGroup} />
      <Separator orientation="vertical" className="h-4 mx-1" />
      <ToolbarGroup editor={editor} items={listGroup} />
      <Separator orientation="vertical" className="h-4 mx-1" />
      <ToolbarGroup editor={editor} items={historyGroup} />
    </div>
  )
}
