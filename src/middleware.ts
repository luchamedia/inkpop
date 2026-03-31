import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/stripe",
  "/api/cron/daily-run",
  "/api/cron/monthly-credits",
  "/api/cron/process-queue",
  "/api/queue/process",
  "/blog(.*)",
  "/robots.txt",
  "/sitemap.xml",
])

export default clerkMiddleware(async (auth, req) => {
  const hostname = req.headers.get("host") || ""
  const appDomain =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "") || ""

  // Subdomain detection
  let subdomain: string | null = null
  const isLocalhost = hostname.includes("localhost")

  if (isLocalhost) {
    // Dev: acme.localhost:3000
    const parts = hostname.split(".")
    if (parts.length > 1 && parts[0] !== "localhost") {
      subdomain = parts[0]
    }
  } else {
    // Prod: acme.inkpop.net
    const baseDomain = appDomain.replace(/:\d+$/, "")
    if (
      hostname !== baseDomain &&
      !hostname.startsWith("www.") &&
      hostname.endsWith(baseDomain)
    ) {
      subdomain = hostname.replace(`.${baseDomain}`, "").split(".")[0]
    }
  }

  // If subdomain detected, rewrite to /blog/[subdomain]/...
  if (subdomain) {
    const url = req.nextUrl.clone()
    url.pathname = `/blog/${subdomain}${url.pathname}`
    return NextResponse.rewrite(url)
  }

  // For main domain: protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // Set pathname header for server components
  const response = NextResponse.next()
  response.headers.set("x-pathname", req.nextUrl.pathname)
  return response
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.svg).*)",
  ],
}
