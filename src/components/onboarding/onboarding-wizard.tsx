"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { StepSite } from "@/components/onboarding/step-site"
import { StepSources } from "@/components/onboarding/step-sources"
import { StepSubscribe } from "@/components/onboarding/step-subscribe"

interface OnboardingWizardProps {
  isSubscribed: boolean
}

export function OnboardingWizard({ isSubscribed }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [siteId, setSiteId] = useState<string | null>(null)

  const steps = isSubscribed
    ? [
        { number: 1, label: "Name your site" },
        { number: 2, label: "Add sources" },
      ]
    : [
        { number: 1, label: "Name your site" },
        { number: 2, label: "Add sources" },
        { number: 3, label: "Subscribe" },
      ]

  async function handleStepSite(data: { name: string; subdomain: string }) {
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const site = await res.json()

    if (site.id) {
      setSiteId(site.id)
      setStep(2)
    }
  }

  async function handleStepSources(
    sources: { type: string; url: string }[]
  ) {
    if (!siteId) return

    for (const source of sources) {
      await fetch(`/api/sites/${siteId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source),
      })
    }

    if (isSubscribed) {
      router.push("/dashboard/sites")
    } else {
      setStep(3)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome to inkpop</h1>
        <p className="text-muted-foreground">
          Let&apos;s set up your AI-powered blog in {steps.length} steps.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex gap-2">
        {steps.map((s) => (
          <div
            key={s.number}
            className={`flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium ${
              s.number === step
                ? "bg-primary text-primary-foreground"
                : s.number < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {step === 1 && <StepSite onNext={handleStepSite} />}
      {step === 2 && (
        <StepSources onNext={handleStepSources} onBack={() => setStep(1)} />
      )}
      {step === 3 && !isSubscribed && (
        <StepSubscribe onBack={() => setStep(2)} />
      )}
    </div>
  )
}
