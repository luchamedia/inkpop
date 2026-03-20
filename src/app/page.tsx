import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Check, Sparkles, Globe, RefreshCw } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Content",
    description:
      "Our AI agent analyzes your sources and creates unique, SEO-optimized blog posts daily.",
  },
  {
    icon: Globe,
    title: "Hosted Blog",
    description:
      "Every site gets a dedicated subdomain blog — no setup, no hosting headaches.",
  },
  {
    icon: RefreshCw,
    title: "Fully Automated",
    description:
      "Connect your sources once. We scrape, write, and queue drafts for you every day.",
  },
]

const pricingFeatures = [
  "Daily AI-generated SEO blog posts",
  "Hosted subdomain blog",
  "Up to 5 content sources per site",
  "YouTube, blog, and webpage scraping",
  "One-click approve & publish",
  "SEO meta descriptions included",
]

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b px-8 py-4">
        <span className="text-xl font-bold">inkpop</span>
        <div className="flex gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center gap-8 px-8 py-24 text-center">
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          5x your organic traffic with AI-generated SEO content
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Connect your YouTube channels, blogs, and webpages. Our AI agent
          scrapes your sources daily and generates SEO-optimized blog posts
          automatically.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/sign-up">Start free trial</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#pricing">See pricing</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/40 px-8 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            How it works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="pt-6">
                  <feature.icon className="mb-4 h-8 w-8 text-primary" />
                  <h3 className="mb-2 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-8 py-20">
        <div className="mx-auto max-w-md text-center">
          <h2 className="mb-4 text-3xl font-bold">Simple pricing</h2>
          <p className="mb-8 text-muted-foreground">
            One plan, everything included. No hidden fees.
          </p>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-6">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="mb-8 space-y-3 text-left">
                {pricingFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="w-full">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-8 py-8 text-center text-sm text-muted-foreground">
        inkpop &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
