'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <div className="w-6 h-6 rounded-lg bg-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">BatchFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your PIN to continue</p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                success
                  ? 'bg-success scale-110'
                  : pin[i]
                  ? 'bg-foreground scale-110'
                  : 'bg-muted border border-input'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-destructive text-center text-sm font-medium mb-4">
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
              className="h-16 rounded-2xl bg-card text-foreground text-2xl font-medium shadow-sm active:scale-[0.95] active:shadow-none transition-all duration-100 disabled:opacity-40 select-none"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleNumberClick('0')}
            disabled={loading}
            className="h-16 rounded-2xl bg-card text-foreground text-2xl font-medium shadow-sm active:scale-[0.95] active:shadow-none transition-all duration-100 disabled:opacity-40 select-none"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="h-16 rounded-2xl bg-card text-muted-foreground shadow-sm active:scale-[0.95] active:shadow-none transition-all duration-100 disabled:opacity-20 select-none flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center mt-6">
            <div className="w-5 h-5 border-2 border-input border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}