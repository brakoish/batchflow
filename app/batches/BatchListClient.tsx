'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import EmptyState from '@/app/components/EmptyState'
import { StopIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import type { Session } from '@/lib/session'

type Step = { id: string; name: string; order: number; status: string; completedQuantity: number; targetQuantity: number | null }
type Assignment = { worker: { id: string; name: string } }
type Batch = {
  id: string; name: string; targetQuantity: number | null; status: string; strain?: string; dueDate?: string
  recipe: { name: string }; steps: Step[]; assignments?: Assignment[]
}

export default function BatchListClient({
  initialBatches, session, organizationName,
}: {
  initialBatches: Batch[]; session: Session; organizationName?: string
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [onShift, setOnShift] = useState(false)
  const [shiftChecked, setShiftChecked] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [clockingIn, setClockingIn] = useState(false)
  const [elapsed, setElapsed] = useState('0h 00m')
  const [refreshing, setRefreshing] = useState(false)
  const [touchStart, setTouchStart] = useState(0)
  const [loading, setLoading] = useState(!initialBatches.length)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = async (showLoading = false) => {
    if (showLoading) setRefreshing(true)
    try {
      const [bRes, sRes] = await Promise.all([
        fetch('/api/batches', { cache: "no-store" }),
        fetch('/api/shifts', { cache: "no-store" }),
      ])
      if (bRes.ok) {
        const data = await bRes.json()
        if (data.batches) {
          setBatches(data.batches)
          setLoading(false)
        }
      }
      if (sRes.ok) {
        const data = await sRes.json()
        setOnShift(!!data.activeShift)
        setShiftChecked(true)
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
      const res = await fetch('/api/shifts', { cache: "no-store" })
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

  const handleQuickClockIn = async () => {
    haptic('medium')
    setClockingIn(true)
    try {
      const res = await fetch('/api/shifts', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setOnShift(true)
        window.dispatchEvent(new Event('shift-changed'))
        if (data.shift) {
          const start = new Date(data.shift.startedAt)
          const now = new Date()
          const ms = Math.max(0, now.getTime() - start.getTime())
          const hrs = Math.floor(ms / 3600000)
          const mins = Math.floor((ms % 3600000) / 60000)
          setElapsed(`${hrs}h ${mins.toString().padStart(2, '0')}m`)
        }
      }
    } catch {}
    setClockingIn(false)
  }

  const handleClockOut = async () => {
    haptic('medium')
    if (!confirm('Clock out?')) return
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (res.ok) {
        setOnShift(false)
        window.dispatchEvent(new Event('shift-changed'))
      }
    } catch {}
  }

  return (
    <AppShell session={session} organizationName={organizationName}>
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
        
        {/* Clock-in nudge banner */}
        {shiftChecked && !onShift && !nudgeDismissed && (session.role === 'WORKER' || session.role === 'SUPERVISOR') && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg shrink-0">👋</span>
              <p className="text-sm text-foreground">You&apos;re not clocked in</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleQuickClockIn}
                disabled={clockingIn}
                className="px-4 py-2.5 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50"
              >
                {clockingIn ? 'Starting...' : 'Clock In'}
              </button>
              <button
                onClick={() => { haptic('light'); setNudgeDismissed(true) }}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Your Batches</h1>
          <p className="text-muted-foreground mt-1">{batches.length} available</p>

          {/* Search */}
          <div className="relative mt-4">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search batches..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Batch Cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (() => {
            const filteredBatches = batches.filter((b) => {
              const query = searchQuery.toLowerCase()
              return (
                b.name.toLowerCase().includes(query) ||
                b.recipe.name.toLowerCase().includes(query) ||
                (b.strain && b.strain.toLowerCase().includes(query))
              )
            })

            if (filteredBatches.length === 0) {
              return searchQuery ? (
                <EmptyState icon="inbox" title="No batches match" description="Try a different search term." />
              ) : (
                <EmptyState icon="inbox" title="No batches" description="Check back later for new work." />
              )
            }

            const myBatches = session.role === 'WORKER'
              ? filteredBatches.filter(b => b.assignments?.some(a => a.worker.id === session.workerId))
              : filteredBatches
            const otherBatches = session.role === 'WORKER'
              ? filteredBatches.filter(b => !b.assignments?.some(a => a.worker.id === session.workerId))
              : []

            const renderBatch = (batch: Batch) => {
              const firstIncomplete = batch.steps.find((s) => s.status !== 'COMPLETED')
              const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length
              const pct = Math.round((completedSteps / batch.steps.length) * 100)
              const isMyTurn = !!firstIncomplete

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
                      {batch.dueDate && (() => {
                        const due = new Date(batch.dueDate.split('T')[0] + 'T00:00:00')
                        const now = new Date()
                        now.setHours(0, 0, 0, 0)
                        const daysLeft = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        const isOverdue = batch.status === 'ACTIVE' && daysLeft < 0
                        const isSoon = batch.status === 'ACTIVE' && daysLeft >= 0 && daysLeft <= 2
                        return (
                          <p className={`text-xs font-medium ${
                            isOverdue ? 'text-red-500 dark:text-red-400' :
                            isSoon ? 'text-amber-500 dark:text-amber-400' :
                            'text-muted-foreground/60'
                          }`}>
                            {isOverdue ? `⚠️ Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${Math.abs(daysLeft)}d overdue)` :
                             isSoon ? `⏰ Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `${daysLeft}d`})` :
                             `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          </p>
                        )
                      })()}
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
                    {batch.dueDate && batch.status === 'ACTIVE' && new Date(batch.dueDate) < new Date() && (
                      <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 text-xs font-semibold">
                        OVERDUE
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
                      <p className="text-xl font-bold text-foreground">{batch.targetQuantity ?? <span className="text-sm text-blue-500">Open</span>}</p>
                      <p className="text-xs text-muted-foreground">units</p>
                    </div>
                  </div>
                </Link>
              )
            }

            return (
              <div className="space-y-4">
                {myBatches.length > 0 && (
                  <>
                    {session.role === 'WORKER' && otherBatches.length > 0 && (
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Batches</h2>
                    )}
                    {myBatches.map(renderBatch)}
                  </>
                )}
                {otherBatches.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-px bg-border" />
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Other Batches</h2>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {otherBatches.map(renderBatch)}
                  </>
                )}
              </div>
            )
        })()}

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