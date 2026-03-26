import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  badge?: string
}

export function EmptyState({ icon: Icon, title, description, action, badge }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-serif text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      {badge && <Badge variant="secondary" className="mt-3">{badge}</Badge>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
