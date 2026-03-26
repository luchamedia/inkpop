import { Skeleton } from "@/components/ui/skeleton"

export default function SiteDetailLoading() {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-full max-w-lg mb-6" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}
