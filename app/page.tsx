'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { haptic } from '@/lib/haptic'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !loading) {
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
    if (!loading) {
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
        body: JSON.stringify({ pin: pinToSubmit }),
      })

      const data = await res.json()

      if (!res.ok) {
        haptic('heavy')
        setError(data.error || 'Invalid PIN')
        setPin('')
        return
      }

      haptic('medium')
      setSuccess(true)
      setTimeout(() => {
        router.push(data.worker.role === 'OWNER' ? '/dashboard' : '/shift')
      }, 300)
    } catch (err) {
      haptic('heavy')
      setError('Connection error')
      setPin('')
    } finally {
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

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        {/* Brand */}
        <div className="text-center mb-10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mx-auto mb-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="6"/>
            <rect x="12" y="56" width="32" height="32" rx="6"/>
            <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
          </svg>
          <h1 className="text-2xl font-semibold text-foreground">BatchFlow</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter your PIN</p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-150 ${
                success
                  ? 'bg-success scale-110'
                  : pin[i]
                  ? 'bg-foreground'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-destructive text-center text-sm mb-6">
            {error}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              disabled={loading}
              className="h-16 rounded-lg bg-card border border-border text-foreground text-xl font-medium hover:bg-muted active:scale-[0.98] transition-all duration-150 disabled:opacity-40"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleNumberClick('0')}
            disabled={loading}
            className="h-16 rounded-lg bg-card border border-border text-foreground text-xl font-medium hover:bg-muted active:scale-[0.98] transition-all duration-150 disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="h-16 rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted active:scale-[0.98] transition-all duration-150 disabled:opacity-20 flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center mt-8">
            <div className="w-5 h-5 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}