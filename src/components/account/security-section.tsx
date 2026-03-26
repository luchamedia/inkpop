"use client"

import { useClerk } from "@clerk/nextjs"
import { Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SecuritySection() {
  const { openUserProfile, signOut } = useClerk()

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={() => openUserProfile()}
        className="flex w-full items-center justify-start gap-3 h-auto px-4 py-3"
      >
        <Settings className="h-4 w-4 text-muted-foreground" />
        <div className="text-left">
          <p className="font-medium">Manage account</p>
          <p className="text-muted-foreground text-xs font-normal">Password, two-factor authentication, and connected accounts</p>
        </div>
      </Button>
      <Button
        variant="outline"
        onClick={() => signOut({ redirectUrl: "/" })}
        className="flex w-full items-center justify-start gap-3 h-auto px-4 py-3"
      >
        <LogOut className="h-4 w-4 text-muted-foreground" />
        <div className="text-left">
          <p className="font-medium">Sign out</p>
          <p className="text-muted-foreground text-xs font-normal">Sign out of your account on this device</p>
        </div>
      </Button>
    </div>
  )
}
