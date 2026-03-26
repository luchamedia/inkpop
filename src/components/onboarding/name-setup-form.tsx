"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function NameSetupForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    const res = await fetch("/api/users/setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (res.ok) {
      router.push("/new-site")
    }
    setSaving(false)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-2xl font-semibold">Welcome to inkpop</h1>
        <p className="text-muted-foreground">What should we call you?</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={!name.trim() || saving}>
          {saving ? "Saving..." : "Get Started"}
        </Button>
      </form>
    </div>
  )
}
