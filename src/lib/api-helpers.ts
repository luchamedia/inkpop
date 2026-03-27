import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"

type AuthUser = Awaited<ReturnType<typeof getAuthUser>>

/**
 * Wraps an API route handler with authentication and top-level error handling.
 * Replaces the duplicated try/catch auth pattern across 24+ routes.
 *
 * Usage:
 *   export async function POST(req: Request) {
 *     return withAuth(async (user) => {
 *       // user is the authenticated DB user
 *       return NextResponse.json({ ok: true })
 *     })
 *   }
 */
export async function withAuth(
  handler: (user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  let user: AuthUser
  try {
    user = await getAuthUser()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return handler(user)
}
