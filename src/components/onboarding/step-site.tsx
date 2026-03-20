"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface StepSiteProps {
  onNext: (data: { name: string; subdomain: string }) => void
}

const RESERVED_SUBDOMAINS = ["www", "app", "api", "mail", "admin", "blog", "help", "support"]

export function StepSite({ onNext }: StepSiteProps) {
  const [name, setName] = useState("")
  const [subdomain, setSubdomain] = useState("")
  const [available, setAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const subdomainTooShort = subdomain.length > 0 && subdomain.length < 3
  const subdomainReserved = RESERVED_SUBDOMAINS.includes(subdomain)

  useEffect(() => {
    if (!subdomain || subdomain.length < 3 || RESERVED_SUBDOMAINS.includes(subdomain)) {
      setAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkSubdomain: true, subdomain }),
        })
        const data = await res.json()
        setAvailable(data.available)
      } catch {
        setAvailable(null)
      }
      setChecking(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [subdomain])

  // Auto-generate subdomain from name
  function handleNameChange(value: string) {
    setName(value)
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    setSubdomain(slug)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Name your site</h2>
        <p className="text-sm text-muted-foreground">
          Choose a name and subdomain for your blog.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Site name</Label>
          <Input
            id="name"
            placeholder="My Awesome Blog"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subdomain">Subdomain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="subdomain"
              placeholder="my-blog"
              value={subdomain}
              onChange={(e) =>
                setSubdomain(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                )
              }
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              .inkpop.net
            </span>
          </div>
          {checking && (
            <p className="text-sm text-muted-foreground">Checking...</p>
          )}
          {!checking && available === true && (
            <p className="text-sm text-green-600">Available</p>
          )}
          {!checking && available === false && (
            <p className="text-sm text-destructive">Already taken</p>
          )}
          {subdomainTooShort && (
            <p className="text-sm text-destructive">Must be at least 3 characters</p>
          )}
          {subdomainReserved && (
            <p className="text-sm text-destructive">This subdomain is reserved</p>
          )}
        </div>
      </div>

      <Button
        onClick={() => onNext({ name, subdomain })}
        disabled={!name || !subdomain || subdomain.length < 3 || subdomainReserved || available === false || checking}
      >
        Next
      </Button>
    </div>
  )
}
