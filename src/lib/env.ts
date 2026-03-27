const requiredServerVars = [
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "MINDSTUDIO_API_KEY",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const

// Only validate on the server (not in browser, not during build)
if (
  typeof window === "undefined" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  const missing = requiredServerVars.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error(`[env] Missing required environment variables: ${missing.join(", ")}`)
    throw new Error("Server configuration error. Please check environment variables.")
  }
}
