"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { StepTopic } from "./step-topic"
import { StepSources } from "./step-sources"
import { StepStyle } from "./step-style"
import { StepFinalize } from "./step-finalize"
import type { WritingPromptInputs } from "@/lib/writing-prompt"

interface WizardData {
  // Step 1: Topic
  topic: string
  topicContext: Array<{ question: string; answer: string }>
  description: string
  companyUrl?: string

  // Step 2: Sources
  sources: Array<{ type: string; url: string; label?: string }>

  // Step 3: Writing Style
  writingPromptInputs: WritingPromptInputs
  writingPrompt: string

  // Step 4: Finalize (name + schedule)
  name: string
  subdomain: string
  postingSchedule: "daily" | "weekly" | "biweekly"
  postsPerPeriod: number
}

const steps = [
  { number: 1, label: "Define your topic" },
  { number: 2, label: "Add sources" },
  { number: 3, label: "Writing style" },
  { number: 4, label: "Finalize" },
]

export function NewSiteWizard() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<WizardData>({
    topic: "",
    topicContext: [],
    description: "",
    sources: [],
    writingPromptInputs: {},
    writingPrompt: "",
    postingSchedule: "weekly",
    postsPerPeriod: 1,
    name: "",
    subdomain: "",
  })

  async function handleComplete() {
    setSubmitting(true)

    try {
      // 1. Create the site
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          subdomain: data.subdomain,
          topic: data.topic,
          topic_context: data.topicContext,
          description: data.description,
          posting_schedule: data.postingSchedule,
          posts_per_period: data.postsPerPeriod,
          writing_prompt: data.writingPrompt || null,
          writing_prompt_inputs: Object.keys(data.writingPromptInputs).length > 0
            ? data.writingPromptInputs
            : null,
        }),
      })
      const site = await res.json()

      if (!site.id) {
        toast({
          title: "Error",
          description: site.error || "Failed to create site",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      // 2. Add sources in parallel
      await Promise.all(
        data.sources.map((source) =>
          fetch(`/api/sites/${site.id}/sources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(source),
          })
        )
      )

      // 3. Redirect to site dashboard
      router.push(`/dashboard/sites/${site.id}`)
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">{steps[step - 1].label}</p>
          <p className="text-xs text-muted-foreground">
            Step {step} of {steps.length}
          </p>
        </div>
        <div className="h-0.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      {step === 1 && (
        <StepTopic
          data={{
            topic: data.topic,
            topicContext: data.topicContext,
            description: data.description,
            companyUrl: data.companyUrl,
          }}
          onNext={(topicData) => {
            setData((prev) => ({ ...prev, ...topicData }))
            setStep(2)
          }}
        />
      )}

      {step === 2 && (
        <StepSources
          topic={data.topic}
          sources={data.sources}
          onUpdate={(sources) => setData((prev) => ({ ...prev, sources }))}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepStyle
          inputs={data.writingPromptInputs}
          writingPrompt={data.writingPrompt}
          description={data.description}
          topic={data.topic}
          onNext={(inputs, prompt) => {
            setData((prev) => ({
              ...prev,
              writingPromptInputs: inputs,
              writingPrompt: prompt,
            }))
            setStep(4)
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepFinalize
          topic={data.topic}
          topicContext={data.topicContext}
          name={data.name}
          subdomain={data.subdomain}
          schedule={data.postingSchedule}
          postsPerPeriod={data.postsPerPeriod}
          onUpdate={(name, subdomain) =>
            setData((prev) => ({ ...prev, name, subdomain }))
          }
          onScheduleUpdate={(schedule, postsPerPeriod) =>
            setData((prev) => ({
              ...prev,
              postingSchedule: schedule,
              postsPerPeriod,
            }))
          }
          onSubmit={handleComplete}
          onBack={() => setStep(3)}
          submitting={submitting}
        />
      )}
    </div>
  )
}
