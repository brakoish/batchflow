'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlayIcon, StopIcon, ClockIcon, CubeIcon, QueueListIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import { formatDuration } from '@/lib/format'

type Shift = { id: string; startedAt: string }
type TodayStats = { batches: number; units: number }
type WorkerStats = {
  totalUnits: number
  totalShifts: number
  totalHours: number
  unitsPerHour: number
  streak: number
}

export default function ShiftScreen({ worker }: { worker: { id: string; name: string; role: string } }) {
  const [shift, setShift] = useState<Shift | null>(null)
  const [elapsed, setElapsed] = useState('0h 00m')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<TodayStats>({ batches: 0, units: 0 })
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check current shift status
    fetch('/api/shifts')
      .then(r => r.json())
      .then(d => {
        setShift(d.activeShift)
        if (d.activeShift) {
          updateElapsed(d.activeShift.startedAt)
        }
      })
      .catch(() => {})

    // Fetch today's stats
    fetch('/api/workers/activity')
      .then(r => r.json())
      .then(d => {
        if (d.workers) {
          const me = d.workers.find((w: any) => w.id === worker.id)
          if (me) {
            setStats({ batches: me.batches?.length || 0, units: me.todayUnits || 0 })
          }
        }
      })
      .catch(() => {})

    // Fetch worker stats
    fetch('/api/workers/stats')
      .then(r => r.json())
      .then(d => {
        if (d.stats) setWorkerStats(d.stats)
      })
      .catch(() => {})
  }, [worker.id])

  // Update elapsed time
  useEffect(() => {
    if (!shift) return
    const id = setInterval(() => updateElapsed(shift.startedAt), 60000)
    return () => clearInterval(id)
  }, [shift])

  const updateElapsed = (startedAt: string) => {
    const start = new Date(startedAt)
    const now = new Date()
    const ms = Math.max(0, now.getTime() - start.getTime())
    const hours = ms / 3600000
    setElapsed(formatDuration(hours))
  }

  const handleClockIn = async () => {
    haptic('medium')
    setLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setShift(data.shift)
        updateElapsed(data.shift.startedAt)
      }
    } catch {}
    setLoading(false)
  }

  const handleClockOut = async () => {
    haptic('medium')
    if (!confirm('End your shift?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (res.ok) setShift(null)
    } catch {}
    setLoading(false)
  }

  // Owners skip this screen
  if (worker.role === 'OWNER') {
    router.push('/dashboard')
    return null
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Status Indicator */}
        <div className={`w-4 h-4 rounded-full mb-6 ${shift ? 'bg-success animate-pulse' : 'bg-muted'}`} />

        {/* Status Text */}
        <h1 className={`text-3xl font-bold mb-2 ${shift ? 'text-success' : 'text-muted-foreground'}`}>
          {shift ? 'ON SHIFT' : 'OFF SHIFT'}
        </h1>

        {/* Welcome */}
        <p className="text-lg text-foreground mb-8">{worker.name}</p>

        {/* Giant Timer */}
        <div className="text-6xl font-bold text-foreground tabular-nums mb-8">
          {elapsed}
        </div>

        {/* Today's Stats */}
        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CubeIcon className="w-5 h-5" />
            <span className="text-sm">{stats.batches} batches</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ClockIcon className="w-5 h-5" />
            <span className="text-sm">{stats.units} units</span>
          </div>
        </div>

        {/* My Stats Button */}
        {workerStats && (
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            {showStats ? 'Hide' : 'Show'} My Stats
          </button>
        )}

        {/* Worker Stats */}
        {showStats && workerStats && (
          <div className="w-full max-w-xs bg-card border border-border rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{workerStats.totalUnits}</p>
                <p className="text-xs text-muted-foreground">Total Units</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{workerStats.unitsPerHour}</p>
                <p className="text-xs text-muted-foreground">Units/Hour</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{workerStats.totalShifts}</p>
                <p className="text-xs text-muted-foreground">Shifts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{workerStats.streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="px-6 pb-8 safe-bottom space-y-3">
        {shift ? (
          <>
            <Link
              href="/batches"
              className="block w-full py-4 rounded-xl bg-primary text-primary-foreground text-lg font-semibold text-center hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
            >
              View Batches
            </Link>
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-destructive-subtle text-destructive text-lg font-semibold hover:bg-destructive hover:text-destructive-foreground active:scale-[0.98] transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <StopIcon className="w-5 h-5" /> Clock Out
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="w-full py-5 rounded-xl bg-success text-success-foreground text-xl font-bold hover:bg-success/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-3"
            >
              <PlayIcon className="w-6 h-6" /> Clock In
            </button>
            <Link
              href="/batches"
              className="block w-full py-3 rounded-xl border border-border text-muted-foreground text-base font-medium text-center hover:text-foreground hover:border-foreground active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
            >
              <QueueListIcon className="w-5 h-5" /> View Batches
            </Link>
          </>
        )}
      </div>
    </div>
  )
}