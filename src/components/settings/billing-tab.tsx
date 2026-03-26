"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Coins } from "lucide-react"
import { AutoRenewToggle } from "@/components/billing/auto-renew-toggle"

interface Transaction {
  id: string
  amount: number
  balance_after: number
  type: string
  created_at: string
}

interface BillingTabProps {
  creditBalance: number
  transactions: Transaction[]
}

export function BillingTab({ creditBalance, transactions }: BillingTabProps) {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div />
        <Button asChild>
          <Link href="/dashboard/top-up">Buy Credits</Link>
        </Button>
      </div>

      <div className="mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <Coins className="h-5 w-5 text-muted-foreground" />
          <p className="text-4xl font-semibold">{creditBalance}</p>
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
        {transactions.length === 0 ? (
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
                      tx.amount > 0 ? "text-success" : "text-destructive"
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
