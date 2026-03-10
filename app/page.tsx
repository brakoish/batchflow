'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { haptic } from '@/lib/haptic'

type RecentWorker = {
  id: string
  name: string
  pin: string
}

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [recentWorkers, setRecentWorkers] = useState<RecentWorker[]>([])
  const router = useRouter()

  // Load recent workers from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentWorkers')
    if (stored) {
      try {
        setRecentWorkers(JSON.parse(stored))
      } catch {}
    }
  }, [])

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

      // Save to recent workers
      const newRecent = [{ id: data.worker.id, name: data.worker.name, pin: pinToSubmit },
        ...recentWorkers.filter(w => w.id !== data.worker.id)
      ].slice(0, 3)
      setRecentWorkers(newRecent)
      localStorage.setItem('recentWorkers', JSON.stringify(newRecent))

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

  const quickLogin = (worker: RecentWorker) => {
    setPin(worker.pin)
    submitPin(worker.pin)
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
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
      {/* Brand */}
      <div className="text-center mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
          <rect x="56" y="12" width="32" height="32" rx="6"/>
          <rect x="12" y="56" width="32" height="32" rx="6"/>
          <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
        </svg>
        <h1 className="text-2xl font-semibold text-foreground">BatchFlow</h1>
      </div>

      {/* PIN Dots */}
      <div className="flex justify-center gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
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
        <p className="text-destructive text-center text-base mb-6 font-medium">
          {error}
        </p>
      )}

      {/* Numpad - Giant buttons */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            disabled={loading}
            className="h-20 rounded-xl bg-card border border-border text-foreground text-2xl font-semibold hover:bg-muted active:scale-[0.95] active:bg-muted transition-all duration-150 disabled:opacity-40"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleBackspace}
          disabled={loading || pin.length === 0}
          className="h-20 rounded-xl bg-card border border-border text-muted-foreground hover:bg-muted active:scale-[0.95] transition-all duration-150 disabled:opacity-20 flex items-center justify-center"
        >
          <ArrowLeftIcon className="w-7 h-7" />
        </button>
        <button
          onClick={() => handleNumberClick('0')}
          disabled={loading}
          className="h-20 rounded-xl bg-card border border-border text-foreground text-2xl font-semibold hover:bg-muted active:scale-[0.95] transition-all duration-150 disabled:opacity-40"
        >
          0
        </button>
        <div className="h-20 rounded-xl bg-transparent" />
      </div>

      {/* Recent Workers */}
      {recentWorkers.length > 0 && (
        <div className="mt-8 w-full max-w-xs">
          <p className="text-xs text-muted-foreground text-center mb-3">Quick Login</p>
          <div className="flex justify-center gap-3">
            {recentWorkers.map((worker) => (
              <button
                key={worker.id}
                onClick={() => quickLogin(worker)}
                disabled={loading}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-foreground active:scale-[0.95] transition-all duration-150 disabled:opacity-40"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">{worker.name[0]}</span>
                </div>
                <span className="text-xs text-muted-foreground">{worker.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center mt-8">
          <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}