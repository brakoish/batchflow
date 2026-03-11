'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import EmptyState from '@/app/components/EmptyState'
import { StopIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
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
  const [elapsed, setElapsed] = useState('0h 00m')
  const [refreshing, setRefreshing] = useState(false)
  const [touchStart, setTouchStart] = useState(0)

  const fetchData = async (showLoading = false) => {
    if (showLoading) setRefreshing(true)
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
    if (showLoading) setRefreshing(false)
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(() => fetchData(), 5000)
    return () => clearInterval(id)
  }, [])

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart > 0 && window.scrollY === 0) {
      const pullDistance = e.touches[0].clientY - touchStart
      if (pullDistance > 100) {
        haptic('light')
        fetchData(true)
        setTouchStart(0)
      }
    }
  }

  useEffect(() => {
    if (!onShift) return
    const update = async () => {
      const res = await fetch('/api/shifts')
      if (res.ok) {
        const data = await res.json()
        if (data.activeShift) {
          const start = new Date(data.activeShift.startedAt)
          const now = new Date()
          const ms = Math.max(0, now.getTime() - start.getTime())
          const hrs = Math.floor(ms / 3600000)
          const mins = Math.floor((ms % 3600000) / 60000)
          setElapsed(`${hrs}h ${mins.toString().padStart(2, '0')}m`)
        }
      }
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [onShift])

  const handleClockOut = async () => {
    haptic('medium')
    if (!confirm('Clock out?')) return
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
      <main 
        className="max-w-2xl mx-auto px-4 py-6 pb-32"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Pull to refresh indicator */}
        {refreshing && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          </div>
        )}
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Your Batches</h1>
          <p className="text-muted-foreground mt-1">{batches.length} available</p>
        </div>

        {/* Batch Cards */}
        {batches.length === 0 ? (
          <EmptyState icon="inbox" title="No batches" description="Check back later for new work." />
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => {
              const firstIncomplete = batch.steps.find((s) => s.status !== 'COMPLETED')
              const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length
              const pct = Math.round((completedSteps / batch.steps.length) * 100)
              const isMyTurn = firstIncomplete && firstIncomplete.status !== 'LOCKED'

              return (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className="block bg-card border border-border rounded-xl p-5 hover:border-primary/30 active:scale-[0.99] transition-all duration-150"
                >
                  {/* Top Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-foreground truncate">{batch.name}</h2>
                      <p className="text-sm text-muted-foreground">{batch.recipe.name}</p>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    {isMyTurn ? (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        YOUR TURN
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                        WAITING
                      </span>
                    )}
                    {batch.strain && (
                      <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                        {batch.strain}
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-4">
                    {/* Circular Progress */}
                    <div className="relative w-12 h-12 shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-muted"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${pct}, 100`}
                          className="text-success"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                        {pct}%
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {completedSteps}/{batch.steps.length} steps complete
                      </p>
                      {firstIncomplete && (
                        <p className="text-sm text-muted-foreground truncate">
                          Next: {firstIncomplete.name}
                        </p>
                      )}
                    </div>

                    {/* Target */}
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-foreground">{batch.targetQuantity}</p>
                      <p className="text-xs text-muted-foreground">units</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Floating Clock Out Bar */}
        {onShift && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
            <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-success animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-foreground">On Shift</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{elapsed}</p>
                </div>
              </div>
              <button
                onClick={handleClockOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive-subtle text-destructive text-sm font-semibold hover:bg-destructive hover:text-destructive-foreground transition-all"
              >
                <StopIcon className="w-4 h-4" /> Clock Out
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  )
}