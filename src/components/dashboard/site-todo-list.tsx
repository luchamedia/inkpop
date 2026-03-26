"use client"

import Link from "next/link"
import { Check, FileText, Calendar, Palette } from "lucide-react"
import { RunAgentButton } from "@/components/agent/run-agent-button"
import { ScheduleConfigCard } from "@/components/dashboard/schedule-config-card"

interface SiteTodoListProps {
  siteId: string
  hasAnyPosts: boolean
  hasSchedule: boolean
  creditBalance: number
  currentSchedule: string
  currentPostsPerPeriod: number
}

interface TodoItem {
  id: string
  label: string
  description: string
  completed: boolean
  icon: React.ComponentType<{ className?: string }>
  action: React.ReactNode
}

export function SiteTodoList({
  siteId,
  hasAnyPosts,
  hasSchedule,
  creditBalance,
  currentSchedule,
  currentPostsPerPeriod,
}: SiteTodoListProps) {
  const todos: TodoItem[] = [
    {
      id: "create-post",
      label: "Create your first post",
      description: "Generate AI-powered blog posts from your sources.",
      completed: hasAnyPosts,
      icon: FileText,
      action: hasAnyPosts ? (
        <Link
          href={`/dashboard/sites/${siteId}/posts`}
          className="text-sm text-primary hover:underline"
        >
          View posts
        </Link>
      ) : (
        <RunAgentButton siteId={siteId} creditBalance={creditBalance} size="sm" />
      ),
    },
    {
      id: "set-schedule",
      label: "Set posting schedule",
      description: "Configure how often AI generates new posts for this site.",
      completed: hasSchedule,
      icon: Calendar,
      action: null,
    },
    {
      id: "customize-look",
      label: "Customize the look",
      description: "Choose colors, layout, and branding for your blog.",
      completed: false,
      icon: Palette,
      action: (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Coming soon
        </span>
      ),
    },
  ]

  const completedCount = todos.filter((t) => t.completed).length

  if (completedCount === todos.length) return null

  return (
    <div className="space-y-0 divide-y divide-border">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">Get started</h3>
        <span className="text-sm text-muted-foreground">
          {completedCount}/{todos.length} completed
        </span>
      </div>
      {todos.map((todo) => (
        <div
          key={todo.id}
          className={`flex items-start gap-4 py-4 ${
            todo.completed ? "opacity-60" : ""
          }`}
        >
          <div
            className={`mt-0.5 ${todo.completed ? "text-success" : "text-muted-foreground"}`}
          >
            {todo.completed ? (
              <Check className="h-5 w-5" />
            ) : (
              <todo.icon className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p
              className={`text-sm font-medium ${
                todo.completed ? "line-through text-muted-foreground" : ""
              }`}
            >
              {todo.label}
            </p>
            <p className="text-xs text-muted-foreground">{todo.description}</p>
            {todo.id === "set-schedule" && !todo.completed && (
              <div className="mt-3">
                <ScheduleConfigCard
                  siteId={siteId}
                  currentSchedule={currentSchedule}
                  currentPostsPerPeriod={currentPostsPerPeriod}
                />
              </div>
            )}
          </div>
          {todo.action && <div className="flex-shrink-0">{todo.action}</div>}
        </div>
      ))}
    </div>
  )
}
