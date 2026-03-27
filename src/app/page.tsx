import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export const metadata: Metadata = {
  title: "inkpop - AI-Powered SEO Blog Platform",
  description:
    "5x your organic traffic with AI-generated SEO content. Connect sources, generate posts, publish to your own blog. 5 free posts every month.",
  alternates: {
    canonical: "https://inkpop.net",
  },
}

const features = [
  {
    title: "Connect your sources",
    description:
      "Add YouTube channels, blogs, and webpages. Our AI scrapes them to understand your niche and audience.",
  },
  {
    title: "AI writes your posts",
    description:
      "Unique, SEO-optimized blog posts generated from your source material — not generic filler.",
  },
  {
    title: "Publish to your blog",
    description:
      "Every site gets a hosted subdomain blog. Review drafts, click publish, and watch your traffic grow.",
  },
]

const pricingFeatures = [
  "AI-generated SEO blog posts",
  "Unlimited sites",
  "Up to 10 content sources per site",
  "Hosted subdomain blog",
  "One-click publish",
]

const creditPacks = [
  {
    name: "Starter",
    credits: 10,
    price: "$5",
    perPost: "$0.50/post",
    discount: null,
  },
  {
    name: "Standard",
    credits: 50,
    price: "$22.50",
    perPost: "$0.45/post",
    discount: "Save 10%",
  },
  {
    name: "Bulk",
    credits: 100,
    price: "$40",
    perPost: "$0.40/post",
    discount: "Save 20%",
  },
]

export default async function HomePage() {
  const { userId } = await auth()
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-serif text-lg font-semibold tracking-tight">
            inkpop
          </Link>
          <div className="flex items-center gap-2">
            {userId ? (
              <Button asChild size="sm">
                <Link href="/dashboard/sites">My Sites</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/sign-up">Get started free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mb-6 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          AI-powered SEO content
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          Write less.
          <br />
          Rank more.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Connect your sources. Get SEO-optimized blog posts generated
          automatically, published to your own hosted subdomain.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg" className="px-8">
            <Link href="/sign-up">Start for free</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="#pricing">View pricing &rarr;</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          5 free posts every month. No credit card required.
        </p>
      </section>

      {/* How it works */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="font-serif text-3xl font-semibold mb-12">
            How it works
          </h2>
          <div className="space-y-12">
            {features.map((feature, i) => (
              <div key={feature.title} className="flex items-start gap-8">
                <span className="text-5xl font-serif font-semibold text-border shrink-0 w-12 text-right">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-serif text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="mb-12">
            <h2 className="font-serif text-3xl font-semibold">
              Simple pricing
            </h2>
            <p className="mt-2 text-muted-foreground">
              Pay per post. No subscriptions. No lock-in.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-10">
            {pricingFeatures.map((f) => (
              <span
                key={f}
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-sm"
              >
                <Check className="h-3 w-3 text-primary" />
                {f}
              </span>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {creditPacks.map((pack) => (
              <div
                key={pack.name}
                className="border border-border rounded p-6 flex flex-col gap-4"
              >
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {pack.name}
                  </p>
                  <p className="mt-2 text-3xl font-semibold font-serif">
                    {pack.price}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pack.credits} posts &middot; {pack.perPost}
                  </p>
                </div>
                {pack.discount && (
                  <span className="inline-flex w-fit items-center rounded-sm bg-ink-yellow-bg px-2 py-0.5 text-[11px] font-medium text-ink-yellow-text">
                    {pack.discount}
                  </span>
                )}
                <Button asChild className="mt-auto">
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
          <span className="font-serif text-sm font-medium">inkpop</span>
          <span className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  )
}
