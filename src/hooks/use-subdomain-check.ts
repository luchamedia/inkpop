import { useState, useEffect, useRef } from "react"

const RESERVED_SUBDOMAINS = [
  "www", "app", "api", "mail", "admin", "blog", "help", "support",
]

interface SubdomainCheckResult {
  available: boolean | null
  checking: boolean
  subdomainTooShort: boolean
  subdomainReserved: boolean
}

export function useSubdomainCheck(subdomain: string): SubdomainCheckResult {
  const [result, setResult] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const prevSubdomainRef = useRef(subdomain)

  const subdomainTooShort = subdomain.length > 0 && subdomain.length < 3
  const subdomainReserved = RESERVED_SUBDOMAINS.includes(subdomain)
  const shouldCheck = subdomain.length >= 3 && !subdomainReserved

  useEffect(() => {
    if (!shouldCheck) return

    // Reset result when subdomain changes
    if (prevSubdomainRef.current !== subdomain) {
      prevSubdomainRef.current = subdomain
    }

    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkSubdomain: true, subdomain }),
        })
        const data = await res.json()
        setResult(data.available)
      } catch {
        setResult(null)
      }
      setChecking(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [subdomain, shouldCheck])

  // If subdomain is invalid, available is always null
  const available = shouldCheck ? result : null

  return { available, checking, subdomainTooShort, subdomainReserved }
}
