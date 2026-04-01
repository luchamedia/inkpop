import { MindStudioAgent } from "@mindstudio-ai/agent"

const agent = new MindStudioAgent()
const AGENT_ID = process.env.MINDSTUDIO_AGENT_ID!

/**
 * Call a named workflow on the MindStudio agent.
 * Prompts live in MindStudio's UI — this just sends variables and parses the result.
 */
export async function callWorkflow<T = string>(
  workflow: string,
  variables: Record<string, unknown>
): Promise<T> {
  const result = await agent.runAgent({
    appId: AGENT_ID,
    workflow,
    variables,
  })

  if (!result.success) {
    throw new Error(`Workflow "${workflow}" failed`)
  }

  // Try JSON parse, fall back to raw string
  try {
    return JSON.parse(result.result) as T
  } catch {
    return result.result as T
  }
}
