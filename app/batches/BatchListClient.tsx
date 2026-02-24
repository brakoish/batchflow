'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import EmptyState from '@/app/components/EmptyState'

import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid'

type Session = { id: string; name: string; role: string }
type Step = { id: string; name: string; order: number; status: string; completedQuantity: number; targetQuantity: number }
type Batch = {
  id: string; name: string; targetQuantity: number; status: string
  recipe: { name: string }; steps: Step[]
}

type Shift = { id: string; status: string; startedAt: string }

export default function BatchListClient({
  initialBatches, session,
}: {
  initialBatches: Batch[]; session: Session
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [shift, setShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const poll = async () => {
      try {
        const [bRes, sRes] = await Promise.all([
          fetch('/api/batches'),
          fetch('/api/shifts'),
        ])
        if (bRes.ok) {
          const data = await bRes.json()
          if (data.batches) setBatches(data.batches)
        }
        if (sRes.ok) {
          const data = await sRes.json()
          setShift(data.activeShift)
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  const handleClockIn = async () => {
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
    setLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (res.ok) {
        setShift(null)
      }
    } catch {}
    setLoading(false)
  }

  return (
    <AppShell session={session}>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* Clock In/Out */}
        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${shift ? 'bg-emerald-500/15' : 'bg-zinc-800'}`}>
                <ClockIcon className={`w-5 h-5 ${shift ? 'text-emerald-400' : 'text-zinc-500'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-50">
                  {shift ? 'On Shift' : 'Not Clocked In'}
                </p>
                {shift && (
                  <p className="text-xs text-emerald-400">
                    Started {new Date(shift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            {shift ? (
              <button
                onClick={handleClockOut}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 active:scale-[0.96] text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                <StopIcon className="w-4 h-4" />Clock Out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                <PlayIcon className="w-4 h-4" />Clock In
              </button>
            )}
          </div>
        </div>

        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Active Batches</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{batches.length} batch{batches.length !== 1 ? 'es' : ''} in progress</p>
        </div>

        {batches.length === 0 ? (
          <EmptyState icon="inbox" title="No active batches" description="Batches will show up here when your team starts a new run." />
        ) : (
          <div className="space-y-2.5">
            {batches.map((batch) => {
              const firstIncomplete = batch.steps.find((s) => s.status !== 'COMPLETED')
              const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length
              const pct = Math.round((completedSteps / batch.steps.length) * 100)

              return (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:translate-y-[-1px] active:scale-[0.99] transition-all duration-150"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-zinc-50 truncate">{batch.name}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{batch.recipe.name}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <span className="text-lg font-bold tabular-nums text-zinc-50">{batch.targetQuantity}</span>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">target</p>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-500">{completedSteps}/{batch.steps.length} steps</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-400">{pct}%</span>
                    </div>
                    {firstIncomplete && (
                      <span className="text-xs text-blue-400 font-medium">
                        {firstIncomplete.name}: {firstIncomplete.completedQuantity}/{firstIncomplete.targetQuantity}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </AppShell>
  )
}
