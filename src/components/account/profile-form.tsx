"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ProfileFormProps {
  name: string
  email: string
}

export function ProfileForm({ name: initialName, email }: ProfileFormProps) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const dirty = name.trim() !== initialName

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch("/api/users/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: "error", text: data.error || "Failed to save" })
        return
      }

      setMessage({ type: "success", text: "Saved" })
    } catch {
      setMessage({ type: "error", text: "Something went wrong" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block">Display name</Label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setMessage(null)
          }}
          maxLength={100}
          className="max-w-sm"
        />
      </div>

      <div>
        <Label className="mb-1.5 block">Email</Label>
        <Input
          value={email}
          disabled
          className="max-w-sm text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1">Managed by your sign-in provider</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty || !name.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {message && (
          <p className={cn("text-sm", message.type === "success" ? "text-success" : "text-destructive")}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
