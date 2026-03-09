'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlayIcon, StopIcon, ArrowRightIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'

type Shift = { id: string; startedAt: string }

export default function ShiftScreen({ worker }: { worker: { id: string; name: string; role: string } }) {
  const [shift, setShift] = useState<Shift | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check current shift status
    fetch('/api/shifts')
      .then(r => r.json())
      .then(d => setShift(d.activeShift))
      .catch(() => {})
  }, [])

  // Update elapsed time every second if on shift
  useEffect(() => {
    if (!shift) return
    const update = () => {
      const ms = Date.now() - new Date(shift.startedAt).getTime()
      const hrs = Math.floor(ms / 3600000)
      const mins = Math.floor((ms % 3600000) / 60000)
      setElapsed(`${hrs}h ${mins}m`)
    }
    update()
    const id = setInterval(update, 60000) // update every minute
    return () => clearInterval(id)
  }, [shift])

  const handleClockIn = async () => {
    haptic('medium')
    setLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
      }
    } catch {}
    setLoading(false)
  }

  const handleClockOut = async () => {
    haptic('medium')
    setLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (res.ok) setShift(null)
    } catch {}
    setLoading(false)
  }

  const goToWork = () => {
    haptic('light')
    router.push('/batches')
  }

  // Owners skip this screen
  if (worker.role === 'OWNER') {
    router.push('/dashboard')
    return null
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
      {/* Worker name */}
      <p className="text-muted-foreground text-sm mb-2">Welcome back,</p>
      <h1 className="text-2xl font-bold text-foreground mb-8">{worker.name}</h1>

      {shift ? (
        // On shift - show status + continue
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">On Shift</span>
          </div>

          <p className="text-4xl font-bold text-foreground tabular-nums mb-1">{elapsed}</p>
          <p className="text-xs text-muted-foreground mb-8">
            Started {new Date(shift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>

          <button
            onClick={goToWork}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-base transition-all flex items-center justify-center gap-2 mb-3"
          >
            Continue to Work <ArrowRightIcon className="w-5 h-5" />
          </button>

          <button
            onClick={handleClockOut}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-card hover:bg-muted border border-border text-red-500 dark:text-red-400 font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            <StopIcon className="w-4 h-4" /> Clock Out
          </button>
        </div>
      ) : (
        // Not on shift - clock in
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-8">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">Not Clocked In</span>
          </div>

          <button
            onClick={handleClockIn}
            disabled={loading}
            className="w-full py-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
          >
            <PlayIcon className="w-6 h-6" /> Clock In
          </button>
          <p className="text-xs text-muted-foreground/70 mt-4">Start your shift to begin logging work</p>
        </div>
      )}
    </div>
  )
}