import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
// Card imports removed — using flat layout
import { Coins } from "lucide-react"
import { AutoRenewToggle } from "@/components/billing/auto-renew-toggle"

export default async function BillingPage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, credit_balance")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, amount, balance_after, type, created_at")
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Billing</h1>
        <Button asChild>
          <Link href="/dashboard/top-up">Buy Credits</Link>
        </Button>
      </div>

      <div className="mb-10 pb-8 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <Coins className="h-5 w-5 text-muted-foreground" />
          <p className="text-4xl font-semibold">{dbUser.credit_balance ?? 0}</p>
        </div>
        <p className="text-sm text-muted-foreground">credits remaining — each generates one AI blog post</p>
      </div>

      <div className="mb-8 rounded bg-background-secondary p-4">
        <p className="text-sm font-medium">Free Tier</p>
        <p className="text-sm text-muted-foreground">
          5 credits refresh monthly — use it or lose it. Buy credit packs for more.
        </p>
      </div>

      <div className="mb-8">
        <AutoRenewToggle />
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold mb-1">Transaction History</h2>
        <p className="text-sm text-muted-foreground mb-4">Recent credit purchases and usage.</p>
          {!transactions || transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions yet. Buy credits to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {tx.type === "purchase"
                        ? "Credit Purchase"
                        : tx.type === "generation"
                          ? "Post Generation"
                          : tx.type === "auto_renew"
                            ? "Auto-Renew Purchase"
                            : tx.type === "free_monthly"
                              ? "Monthly Free Credits"
                              : tx.type === "refund"
                                ? "Refund"
                                : tx.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        tx.amount > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance: {tx.balance_after}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
