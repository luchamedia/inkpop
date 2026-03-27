import type { Metadata } from "next"
import { Inter, Lora } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  style: ["normal", "italic"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://inkpop.net"),
  title: {
    default: "inkpop - AI-Powered SEO Blog Platform",
    template: "%s | inkpop",
  },
  description:
    "5x your organic traffic with AI-generated SEO content. Connect sources, generate posts, publish to your own blog.",
  openGraph: {
    type: "website",
    siteName: "inkpop",
    title: "inkpop - AI-Powered SEO Blog Platform",
    description:
      "5x your organic traffic with AI-generated SEO content. Connect sources, generate posts, publish to your own blog.",
    url: "https://inkpop.net",
  },
  twitter: {
    card: "summary_large_image",
    title: "inkpop - AI-Powered SEO Blog Platform",
    description:
      "5x your organic traffic with AI-generated SEO content.",
  },
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${lora.variable}`} suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
            }}
          />
        </head>
        <body className="font-sans">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}
