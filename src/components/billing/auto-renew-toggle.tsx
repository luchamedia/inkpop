"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const packOptions = [
  { value: "pack_10", label: "Starter - 10 credits ($5)" },
  { value: "pack_50", label: "Standard - 50 credits ($22.50)" },
  { value: "pack_100", label: "Bulk - 100 credits ($40)" },
]

export function AutoRenewToggle() {
  const [enabled, setEnabled] = useState(false)
  const [pack, setPack] = useState("pack_10")
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/billing/auto-renew")
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.auto_renew)
        if (data.auto_renew_pack) setPack(data.auto_renew_pack)
        setHasPaymentMethod(data.has_payment_method)
        setLoading(false)
      })
  }, [])

  async function save(newEnabled: boolean, newPack: string) {
    setSaving(true)
    try {
      const res = await fetch("/api/billing/auto-renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled, pack: newPack }),
      })
      if (!res.ok) {
        const data = await res.json()
        console.error("Auto-renew save error:", data.error)
        // Revert on failure
        setEnabled(!newEnabled)
      }
    } catch {
      setEnabled(!newEnabled)
    } finally {
      setSaving(false)
    }
  }

  function handleToggle(checked: boolean) {
    setEnabled(checked)
    save(checked, pack)
  }

  function handlePackChange(value: string) {
    setPack(value)
    if (enabled) {
      save(true, value)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto-Renew</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Renew</CardTitle>
        <CardDescription>
          Automatically purchase more credits when your balance runs out
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasPaymentMethod ? (
          <p className="text-sm text-muted-foreground">
            Purchase credits at least once to enable auto-renew.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch
                id="auto-renew"
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={saving}
              />
              <Label htmlFor="auto-renew">
                {enabled ? "Auto-renew is on" : "Auto-renew is off"}
              </Label>
            </div>

            {enabled && (
              <div className="space-y-2">
                <Label htmlFor="auto-renew-pack">Default pack</Label>
                <Select
                  value={pack}
                  onValueChange={handlePackChange}
                  disabled={saving}
                >
                  <SelectTrigger id="auto-renew-pack" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {packOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This pack will be charged to your saved card when credits hit zero.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
