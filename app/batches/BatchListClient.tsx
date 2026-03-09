'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import EmptyState from '@/app/components/EmptyState'
import { StopIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'

type Session = { id: string; name: string; role: string }
type Step = { id: string; name: string; order: number; status: string; completedQuantity: number; targetQuantity: number }
type Batch = {
  id: string; name: string; targetQuantity: number; status: string; strain?: string
  recipe: { name: string }; steps: Step[]
}

export default function BatchListClient({
  initialBatches, session,
}: {
  initialBatches: Batch[]; session: Session
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [onShift, setOnShift] = useState(false)
  const [elapsed, setElapsed] = useState('')

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
          setOnShift(!!data.activeShift)
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  // Update elapsed time
  useEffect(() => {
    if (!onShift) return
    const update = async () => {
      const res = await fetch('/api/shifts')
      if (res.ok) {
        const data = await res.json()
        if (data.activeShift) {
          const ms = Date.now() - new Date(data.activeShift.startedAt).getTime()
          const hrs = Math.floor(ms / 3600000)
          const mins = Math.floor((ms % 3600000) / 60000)
          setElapsed(`${hrs}h ${mins}m`)
        }
      }
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [onShift])

  const handleClockOut = async () => {
    haptic('medium')
    if (!confirm('Clock out and end your shift?')) return
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (res.ok) {
        setOnShift(false)
        window.location.reload()
      }
    } catch {}
  }

  return (
    <AppShell session={session}>
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Active Batches</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{batches.length} batch{batches.length !== 1 ? 'es' : ''} in progress</p>
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
                  className="block rounded-xl border border-border bg-card p-4 hover:border-input hover:translate-y-[-1px] active:scale-[0.99] transition-all duration-150"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-sm font-semibold text-foreground truncate">{batch.name}</h2>
                        {batch.strain && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                            {batch.strain}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{batch.recipe.name}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <span className="text-lg font-bold tabular-nums text-foreground">{batch.targetQuantity}</span>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">target</p>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">{completedSteps}/{batch.steps.length} steps</span>
                      <span className="text-border">·</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    {firstIncomplete && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {firstIncomplete.name}: {firstIncomplete.completedQuantity}/{firstIncomplete.targetQuantity}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Floating Clock Out Bar */}
        {onShift && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border safe-bottom">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <p className="text-xs font-medium text-foreground">On Shift</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{elapsed}</p>
                </div>
              </div>
              <button
                onClick={handleClockOut}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium transition-colors"
              >
                <StopIcon className="w-3.5 h-3.5" /> Clock Out
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}