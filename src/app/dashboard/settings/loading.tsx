import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div>
      <Skeleton className="h-9 w-32 mb-6" />
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="space-y-6">
        <Skeleton className="h-20 max-w-sm" />
        <Skeleton className="h-20 max-w-sm" />
      </div>
    </div>
  )
}
