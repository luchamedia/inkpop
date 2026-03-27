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

const missing = requiredServerVars.filter((key) => !process.env[key])

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables:\n  ${missing.join("\n  ")}`
  )
}
