"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Settings, AlertTriangle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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
  const [autoPublish, setAutoPublish] = useState(site.auto_publish)
  const [savingAutoPublish, setSavingAutoPublish] = useState(false)

  const hasChanges = name !== site.name

  async function handleToggleAutoPublish(checked: boolean) {
    setSavingAutoPublish(true)
    setAutoPublish(checked)
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_publish: checked }),
      })
      if (res.ok) {
        toast({ title: checked ? "Auto-publish enabled" : "Auto-publish disabled" })
        router.refresh()
      } else {
        setAutoPublish(!checked) // revert on failure
        toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
      }
    } catch {
      setAutoPublish(!checked)
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
    } finally {
      setSavingAutoPublish(false)
    }
  }

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
    <div className="mt-8 space-y-8">
      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-sm font-medium">Site Details</h3>
          </div>
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
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-serif text-sm font-medium">Auto-Publish</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 mr-4">
              <p className="text-sm">Publish posts automatically</p>
              <p className="text-xs text-muted-foreground">
                When enabled, AI-generated posts will be published automatically without review.
              </p>
            </div>
            <Switch
              checked={autoPublish}
              onCheckedChange={handleToggleAutoPublish}
              disabled={savingAutoPublish}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-destructive/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-serif text-sm font-medium text-destructive">Danger Zone</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Permanently delete this site and all its content. This action cannot be undone.
          </p>
          <DeleteSiteButton siteId={site.id} siteName={site.name} />
        </CardContent>
      </Card>
    </div>
  )
}
