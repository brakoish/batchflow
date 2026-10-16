'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/haptic'

type OrgResult = { id: string; name: string; slug: string }
const LAST_ORG_KEY = 'batchflow:lastOrg'

export default function LandingPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrgResult[]>([])
  const [searching, setSearching] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [focused, setFocused] = useState(false)
  const [checkingLastOrg, setCheckingLastOrg] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)
  const router = useRouter()

  // Send returning workers straight back to their org PIN pad.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    try {

    if (params.get('switchOrg') === '1') {
      localStorage.removeItem(LAST_ORG_KEY)
      window.history.replaceState(null, '', '/')
      setCheckingLastOrg(false)
      return
    }

    const lastOrg = localStorage.getItem(LAST_ORG_KEY)
    if (lastOrg) {
      router.replace(`/o/${lastOrg}`)
      return
    }

    setCheckingLastOrg(false)
    } catch { setCheckingLastOrg(false) }
  }, [router])

  // Auto-focus on mount
  useEffect(() => {
    if (checkingLastOrg) return
    inputRef.current?.focus()
  }, [checkingLastOrg])

  // Search orgs as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const controller = new AbortController()

    if (!query.trim()) {
      setResults([])
      setNoResults(false)
      setSearching(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: 'no-store' })
        if (res.ok && !controller.signal.aborted) {
          const data = await res.json()
          if (controller.signal.aborted) return
          setResults(data.organizations || [])
          setNoResults((data.organizations || []).length === 0)
        }
      } catch {
        if (!controller.signal.aborted) setResults([])
      }
      if (!controller.signal.aborted) setSearching(false)
    }, 300)

    return () => {
      controller.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleOrgSelect = (slug: string) => {
    haptic('medium')
    try { localStorage.setItem(LAST_ORG_KEY, slug) } catch {}
    router.push(`/o/${slug}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (results.length === 1) {
      handleOrgSelect(results[0].slug)
    } else if (query.trim()) {
      // Try direct slug navigation
      const slug = query.trim().toLowerCase().replace(/\s+/g, '-')
      try { localStorage.setItem(LAST_ORG_KEY, slug) } catch {}
      router.push(`/o/${slug}`)
    }
  }

  if (checkingLastOrg) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
      {/* Brand */}
      <div className="text-center mb-10">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
          <rect x="56" y="12" width="32" height="32" rx="6"/>
          <rect x="12" y="56" width="32" height="32" rx="6"/>
          <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
        </svg>
        <h1 className="text-2xl font-semibold text-foreground">BatchFlow</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Production tracking for your team
        </p>
      </div>

      {/* Org Search */}
      <div className="w-full max-w-sm" onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false) }} onKeyDown={(event) => {
        if (event.key === 'Escape') { setFocused(false); inputRef.current?.focus() }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-org-result]'))
          if (!buttons.length) return
          event.preventDefault()
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
        }
      }}>
        <form onSubmit={handleSubmit}>
          <label htmlFor="organization-search" className="block text-sm font-medium text-foreground mb-2 text-center">
            Find your organization
          </label>
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="organization-search"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Organization name..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted text-foreground text-base placeholder:text-muted-foreground/60 border border-border focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 transition-all"
              autoComplete="off"
            />
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
              </div>
            )}
          </div>
        </form>

        {/* Search Results */}
        {focused && results.length > 0 && (
          <div className="mt-2 bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
            {results.map((org) => (
              <button
                data-org-result
                key={org.id}
                onClick={() => handleOrgSelect(org.slug)}
                className="w-full px-5 py-4 text-left hover:bg-muted/50 active:bg-muted transition-colors flex items-center justify-between group"
              >
                <div>
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{org.slug}</p>
                </div>
                <svg className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {focused && noResults && query.trim() && !searching && (
          <div className="mt-2 bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-sm text-muted-foreground">
              No organization found for &quot;{query}&quot;
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Check with your manager for the correct name
            </p>
          </div>
        )}

        {/* Direct slug hint */}
        {!focused && !query && (
          <p className="text-xs text-muted-foreground/60 text-center mt-3">
            Or go directly to <span className="font-mono">batchflow.app/o/your-org</span>
          </p>
        )}
      </div>

      {/* Footer Links */}
      <div className="mt-12 text-center space-y-3">
        <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors block">
          Owner? Sign in with email
        </a>
        <a href="/org/new" className="text-sm text-muted-foreground hover:text-foreground transition-colors block">
          Create a new organization
        </a>
      </div>
    </div>
  )
}
