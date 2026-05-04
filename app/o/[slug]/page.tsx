'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { haptic } from '@/lib/haptic'

export default function OrgLoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgNotFound, setOrgNotFound] = useState(false)
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  useEffect(() => {
    // Fetch organization info
    const fetchOrg = async () => {
      try {
        const res = await fetch(`/api/organizations/${slug}`)
        if (res.ok) {
          const data = await res.json()
          setOrgName(data.organization.name)
        } else {
          setOrgNotFound(true)
          setError('Organization not found')
        }
      } catch (err) {
        setOrgNotFound(true)
        setError('Failed to load organization')
      }
    }
    fetchOrg()
  }, [slug])

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !loading && !orgNotFound) {
      haptic('light')
      const newPin = pin + num
      setPin(newPin)
      setError('')

      if (newPin.length === 4) {
        setTimeout(() => submitPin(newPin), 150)
      }
    }
  }

  const handleBackspace = () => {
    if (!loading && !orgNotFound) {
      haptic('light')
      setPin(pin.slice(0, -1))
      setError('')
    }
  }

  const submitPin = async (pinToSubmit: string) => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToSubmit, slug }),
      })

      const data = await res.json()

      if (!res.ok) {
        haptic('heavy')
        setError(data.error || 'Invalid PIN')
        setPin('')
        setLoading(false)
        return
      }

      haptic('medium')
      setSuccess(true)
      setTimeout(() => {
        router.push(data.worker.role === 'OWNER' ? '/dashboard' : '/batches')
      }, 300)
    } catch (err) {
      haptic('heavy')
      setError('Connection error')
      setPin('')
      setLoading(false)
    }
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleNumberClick(e.key)
      if (e.key === 'Backspace') handleBackspace()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (orgNotFound) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="6"/>
            <rect x="12" y="56" width="32" height="32" rx="6"/>
            <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
          </svg>
          <h1 className="text-2xl font-semibold text-foreground mb-4">Organization Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The organization &quot;{slug}&quot; could not be found.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Go to Login
          </a>
        </div>
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
        <h1 className="text-2xl font-semibold text-foreground">
          {orgName ? `Welcome to ${orgName}` : 'Loading...'}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Enter your PIN</p>
      </div>

      {/* PIN Dots */}
      <div
        key={error ? `err-${error}` : 'ok'}
        className={`flex justify-center gap-3 mb-8 ${error ? 'animate-shake' : ''}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
              success
                ? 'bg-emerald-500 scale-110'
                : pin[i]
                ? 'bg-foreground'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && !orgNotFound && (
        <p className="text-red-500 dark:text-red-400 text-center text-base mb-6 font-medium">
          {error}
        </p>
      )}

      {/* Numpad - Giant buttons */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            disabled={loading || orgNotFound}
            className="h-20 rounded-2xl bg-muted text-foreground text-2xl font-medium hover:bg-muted/80 active:scale-[0.95] transition-all duration-150 disabled:opacity-40"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleBackspace}
          disabled={loading || pin.length === 0 || orgNotFound}
          className="h-20 rounded-2xl bg-muted text-muted-foreground hover:bg-muted/80 active:scale-[0.95] transition-all duration-150 disabled:opacity-20 flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <button
          onClick={() => handleNumberClick('0')}
          disabled={loading || orgNotFound}
          className="h-20 rounded-2xl bg-muted text-foreground text-2xl font-medium hover:bg-muted/80 active:scale-[0.95] transition-all duration-150 disabled:opacity-40"
        >
          0
        </button>
        <div className="h-20" />
      </div>

      {loading && (
        <div className="flex justify-center mt-8">
          <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {/* Back to general login */}
      <div className="mt-8 text-center">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Use a different organization
        </a>
      </div>
    </div>
  )
}
