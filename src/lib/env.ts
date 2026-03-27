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

if (process.env.NEXT_PHASE !== "phase-production-build") {
  const missing = requiredServerVars.filter((key) => !process.env[key])

  if (missing.length > 0) {
    // Log details server-side only, throw generic message for clients
    console.error(`[env] Missing required environment variables: ${missing.join(", ")}`)
    throw new Error("Server configuration error. Please check environment variables.")
  }
}
