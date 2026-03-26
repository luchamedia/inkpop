"use client"

import { ProfileForm } from "@/components/account/profile-form"
import { AppearanceSection } from "@/components/account/appearance-section"
import { SecuritySection } from "@/components/account/security-section"

interface AccountTabProps {
  name: string
  email: string
}

export function AccountTab({ name, email }: AccountTabProps) {
  return (
    <div>
      {/* Profile */}
      <section className="mb-8 pb-6 border-b border-border">
        <h2 className="font-serif text-xl font-semibold mb-1">Profile</h2>
        <p className="text-sm text-muted-foreground mb-4">Your personal information.</p>
        <ProfileForm name={name} email={email} />
      </section>

      {/* Appearance */}
      <section className="mb-8 pb-6 border-b border-border">
        <h2 className="font-serif text-xl font-semibold mb-1">Appearance</h2>
        <AppearanceSection />
      </section>

      {/* Security */}
      <section>
        <h2 className="font-serif text-xl font-semibold mb-1">Security</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Manage your password, two-factor authentication, and active sessions.
        </p>
        <SecuritySection />
      </section>
    </div>
  )
}
