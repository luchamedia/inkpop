"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, X, RotateCcw, CheckCircle2, AlertCircle, Clock, Pen, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface QueueItem {
  id: string
  job_type: "idea" | "topic" | "scheduled"
  idea_id: string | null
  topic: string | null
  status: "queued" | "processing" | "completed" | "failed"
  position: number
  post_id: string | null
  error_message: string | null
  retry_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  display_title: string
  post_title: string | null
}

interface QueueListProps {
  siteId: string
  creditBalance: number
  onQueueChange?: (activeCount: number) => void
}

export function QueueList({ siteId, creditBalance, onQueueChange }: QueueListProps) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const { toast } = useToast()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const prevCompletedRef = useRef<Set<string>>(new Set())

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/queue`)
      if (res.ok) {
        const data: QueueItem[] = await res.json()

        // Detect newly completed items for toast notifications
        const newCompleted = data.filter(
          (item) => item.status === "completed" && !prevCompletedRef.current.has(item.id)
        )
        for (const item of newCompleted) {
          toast({
            title: "Post generated",
            description: item.post_title || item.display_title,
          })
        }
        prevCompletedRef.current = new Set(
          data.filter((i) => i.status === "completed").map((i) => i.id)
        )

        setItems(data)
        const activeCount = data.filter(
          (i) => i.status === "queued" || i.status === "processing"
        ).length
        onQueueChange?.(activeCount)
      }
    } catch {
      // Silently fail — will retry on next poll
    } finally {
      setLoading(false)
    }
  }, [siteId, toast, onQueueChange])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Poll every 5s while there are active items
  useEffect(() => {
    const hasActive = items.some(
      (i) => i.status === "queued" || i.status === "processing"
    )

    if (hasActive) {
      intervalRef.current = setInterval(fetchQueue, 5000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [items, fetchQueue])

  async function handleCancel(queueId: string) {
    setCancellingId(queueId)
    try {
      const res = await fetch(`/api/sites/${siteId}/queue/${queueId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Cancelled", description: "Job removed from queue. Credit refunded." })
        await fetchQueue()
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.error || "Failed to cancel",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to cancel job",
        variant: "destructive",
      })
    } finally {
      setCancellingId(null)
    }
  }

  async function handleRetry(item: QueueItem) {
    if (creditBalance <= 0) {
      toast({
        title: "No credits",
        description: "Purchase credits to retry generation.",
        variant: "destructive",
      })
      return
    }

    // Re-queue by posting to the queue endpoint
    try {
      const body =
        item.job_type === "idea"
          ? { type: "idea", ideaId: item.idea_id }
          : { type: "topic", topic: item.topic }

      const res = await fetch(`/api/sites/${siteId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        // Remove the failed item from display
        // (it stays in DB but a new queued item is created)
        toast({ title: "Retrying", description: "Job re-added to queue." })
        await fetchQueue()
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.error || "Failed to retry",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to retry job",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading queue...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded bg-muted/50 py-8 px-4 flex flex-col items-center text-center">
        <ListOrdered className="h-5 w-5 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No items in the queue. Generate posts from the Ideas tab.
        </p>
      </div>
    )
  }

  const active = items.filter((i) => i.status === "queued" || i.status === "processing")
  const finished = items.filter((i) => i.status === "completed" || i.status === "failed")

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="grid gap-2">
          {active.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              siteId={siteId}
              cancellingId={cancellingId}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <>
          {active.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">Recent</p>
          )}
          <div className="grid gap-2">
            {finished.map((item) => (
              <QueueItemRow
                key={item.id}
                item={item}
                siteId={siteId}
                cancellingId={cancellingId}
                onCancel={handleCancel}
                onRetry={item.status === "failed" ? () => handleRetry(item) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function QueueItemRow({
  item,
  siteId,
  cancellingId,
  onCancel,
  onRetry,
}: {
  item: QueueItem
  siteId: string
  cancellingId: string | null
  onCancel: (id: string) => void
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded border border-border">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <StatusIcon status={item.status} />
        <div className="min-w-0 flex-1">
          {item.status === "completed" && item.post_id ? (
            <Link
              href={`/dashboard/sites/${siteId}/posts/${item.post_id}`}
              className="text-sm font-medium truncate block hover:underline"
            >
              {item.post_title || item.display_title}
            </Link>
          ) : (
            <p className="text-sm font-medium truncate">{item.display_title}</p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={item.status} />
            {item.status === "queued" && (
              <span className="text-[10px] text-muted-foreground">#{item.position}</span>
            )}
            {item.error_message && item.status === "failed" && (
              <span className="text-[10px] text-destructive truncate max-w-[200px]">
                {item.error_message}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-2">
        {item.status === "queued" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onCancel(item.id)}
            disabled={cancellingId === item.id}
          >
            {cancellingId === item.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        )}
        {item.status === "failed" && onRetry && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onRetry}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: QueueItem["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
    case "processing":
      return <Pen className="h-4 w-4 text-primary shrink-0 animate-pulse" />
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
    case "failed":
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
  }
}

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  const labels: Record<string, string> = {
    queued: "Queued",
    processing: "Writing...",
    completed: "Done",
    failed: "Failed",
  }

  const variants: Record<string, string> = {
    queued: "text-muted-foreground bg-muted",
    processing: "text-primary bg-primary/10",
    completed: "text-green-700 bg-green-100",
    failed: "text-destructive bg-destructive/10",
  }

  return (
    <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${variants[status]}`}>
      {labels[status]}
    </span>
  )
}
