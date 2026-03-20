const MINDSTUDIO_BASE = "https://api.mindstudio.ai/developer/v2"

export async function triggerAgentRun(
  siteId: string,
  sources: { type: string; url: string }[]
) {
  const res = await fetch(`${MINDSTUDIO_BASE}/agents/execute`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agentId: process.env.MINDSTUDIO_AGENT_ID,
      variables: {
        siteId,
        sources: JSON.stringify(sources),
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MindStudio API error: ${res.status} ${text}`)
  }

  const data = await res.json()
  return { jobId: data.threadId || data.id }
}

export async function getJobStatus(jobId: string) {
  const res = await fetch(`${MINDSTUDIO_BASE}/agents/threads/${jobId}`, {
    headers: {
      Authorization: `Bearer ${process.env.MINDSTUDIO_API_KEY}`,
    },
  })

  if (!res.ok) {
    return { status: "pending" }
  }

  const data = await res.json()
  return data
}
