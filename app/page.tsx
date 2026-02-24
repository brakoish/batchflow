'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num
      setPin(newPin)
      setError('')

      // Auto-submit when 4th digit is entered
      if (newPin.length === 4) {
        setTimeout(() => {
          submitPin(newPin)
        }, 100)
      }
    }
  }

  const handleBackspace = () => {
    setPin(pin.slice(0, -1))
    setError('')
  }

  const submitPin = async (pinToSubmit: string) => {
    if (pinToSubmit.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: pinToSubmit }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid PIN')
        setPin('')
        return
      }

      // Redirect based on role
      if (data.worker.role === 'OWNER') {
        router.push('/dashboard')
      } else {
        router.push('/batches')
      }
    } catch (err) {
      setError('Connection error')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    submitPin(pin)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">BatchFlow</h1>
          <p className="text-zinc-400">Enter your 4-digit PIN</p>
        </div>

        {/* PIN Display */}
        <div className="bg-zinc-900 rounded-2xl p-8 mb-6 border border-zinc-800">
          <div className="flex justify-center gap-4 mb-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-14 h-14 rounded-xl bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center"
              >
                {pin[i] ? (
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                )}
              </div>
            ))}
          </div>
          {error && (
            <p className="text-red-500 text-center text-sm mt-4">{error}</p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              disabled={loading}
              className="h-16 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-2xl font-semibold border border-zinc-700 transition-colors disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleNumberClick('0')}
            disabled={loading}
            className="h-16 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-2xl font-semibold border border-zinc-700 transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="h-16 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-xl font-semibold border border-zinc-700 transition-colors disabled:opacity-50"
          >
            ‹
          </button>
        </div>
      </div>
    </div>
  )
}
