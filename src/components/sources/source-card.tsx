"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Globe, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import type { SourceData } from "@/components/site-dashboard/site-dashboard"

const typeConfig: Record<string, { label: string; className: string }> = {
  youtube: {
    label: "YouTube",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  blog: {
    label: "Blog",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  webpage: {
    label: "Webpage",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function faviconSrc(source: SourceData): string {
  if (source.favicon_url) return source.favicon_url
  try {
    const domain = new URL(source.url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ""
  }
}

function Favicon({ source }: { source: SourceData }) {
  const [failed, setFailed] = useState(false)
  const src = faviconSrc(source)

  if (!src || failed) {
    return <Globe className="h-4 w-4 text-muted-foreground/60 shrink-0" />
  }

  return (
    <img
      src={src}
      alt=""
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function OgImage({ source }: { source: SourceData }) {
  const [failed, setFailed] = useState(false)

  if (!source.og_image_url || failed) return null

  return (
    <div className="w-full aspect-[1.91/1] rounded-md overflow-hidden bg-muted">
      <img
        src={source.og_image_url}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

interface SourceCardProps {
  source: SourceData
  onDelete?: (id: string) => void
  actions?: ReactNode
  reason?: string | null
}

export function SourceCard({ source, onDelete, actions, reason }: SourceCardProps) {
  const config = typeConfig[source.type] || typeConfig.webpage
  const displayTitle =
    source.meta_title || source.label || hostnameOf(source.url)

  return (
    <Card className="border border-border h-full overflow-hidden">
      {/* OG Image */}
      <OgImage source={source} />

      <CardContent className="p-4 flex flex-col h-full">
        {/* Header: favicon + hostname + type badge + delete */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Favicon source={source} />
            <span className="text-[11px] text-muted-foreground truncate">
              {hostnameOf(source.url)}
            </span>
            <Badge
              variant="secondary"
              className={`text-[10px] shrink-0 ${config.className}`}
            >
              {config.label}
            </Badge>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(source.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium leading-snug mb-1">
          {displayTitle}
        </h3>

        {/* Description */}
        {(source.meta_description || reason) && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {source.meta_description || reason}
          </p>
        )}

        {/* Spacer to push URL to bottom */}
        <div className="flex-1" />

        {/* URL link */}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 group"
        >
          <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
          <span className="truncate">{source.url}</span>
        </a>

        {/* Optional action buttons */}
        {actions && <div className="mt-3">{actions}</div>}
      </CardContent>
    </Card>
  )
}
