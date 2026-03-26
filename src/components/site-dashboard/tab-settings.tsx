"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { DeleteSiteButton } from "@/components/dashboard/delete-site-button"
import type { SiteData } from "./site-dashboard"

interface TabSettingsProps {
  site: SiteData
}

export function TabSettings({ site }: TabSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState(site.name)
  const [saving, setSaving] = useState(false)

  const hasChanges = name !== site.name

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        toast({ title: "Site name updated" })
        router.refresh()
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error || "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update site name", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 space-y-10">
      <div>
        <h3 className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Site Details
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Subdomain</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {site.subdomain}.inkpop.net
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Subdomain cannot be changed after creation.
            </p>
          </div>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <h3 className="font-serif text-sm font-medium text-destructive uppercase tracking-wide mb-3">
          Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Permanently delete this site and all its content. This action cannot be undone.
        </p>
        <DeleteSiteButton siteId={site.id} siteName={site.name} />
      </div>
    </div>
  )
}
