'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePullToRefresh } from '@/app/components/usePullToRefresh'
import AppShell from '@/app/components/AppShell'
import EmptyState from '@/app/components/EmptyState'
import { ChevronRightIcon, FlagIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import { onBatchChanged } from '@/lib/batchEvents'
import type { Session } from '@/lib/session'

type Step = { id: string; name: string; order: number; status: string; completedQuantity: number; targetQuantity: number | null }
type Assignment = { worker: { id: string; name: string } }
type Batch = {
  id: string; name: string; targetQuantity: number | null; status: string; strain?: string; dueDate?: string; notes?: string | null
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
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(!initialBatches.length)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'newest' | 'dueDate' | 'progress'>('priority')
  const [priorityFilter, setPriorityFilter] = useState(false)

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
    // 15s safety-net polling; events cover same-tab mutations
    const id = setInterval(() => fetchData(), 15000)
    const unsubscribe = onBatchChanged(() => fetchData())
    return () => {
      clearInterval(id)
      unsubscribe()
    }
  }, [])

  const { handlers: ptrHandlers } = usePullToRefresh(() => { setRefreshing(true); fetchData(true) }, 80)

  const handleQuickClockIn = async () => {
    haptic('medium')
    setClockingIn(true)
    try {
      const res = await fetch('/api/shifts', { method: 'POST' })
      if (res.ok) {
        setOnShift(true)
        window.dispatchEvent(new Event('shift-changed'))
      }
    } catch {}
    setClockingIn(false)
  }

  return (
    <AppShell session={session} organizationName={organizationName}>
      <main 
        className="max-w-2xl mx-auto px-4 py-6 pb-24"
        onTouchStart={ptrHandlers.onTouchStart}
        onTouchMove={ptrHandlers.onTouchMove}
        onTouchEnd={ptrHandlers.onTouchEnd}
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
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search batches..."
                className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort batches"
              className="shrink-0 min-h-[44px] px-3 rounded-lg bg-muted/50 border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            >
              <option value="priority">Priority</option>
              <option value="newest">Newest</option>
              <option value="dueDate">Due date</option>
              <option value="progress">Progress</option>
            </select>
            <button
              onClick={() => { haptic('light'); setPriorityFilter(!priorityFilter) }}
              className={`shrink-0 flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-all active:scale-[0.96] ${
                priorityFilter
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400'
                  : 'bg-muted/50 border-input text-muted-foreground hover:text-foreground'
              }`}
            >
              <FlagIcon className="w-4 h-4" />
              {priorityFilter ? 'All' : 'High+'}
            </button>
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
            let filteredBatches = batches.filter((b) => {
              const query = searchQuery.toLowerCase()
              const matchesSearch = (
                b.name.toLowerCase().includes(query) ||
                b.recipe.name.toLowerCase().includes(query) ||
                (b.strain && b.strain.toLowerCase().includes(query))
              )
              if (!matchesSearch) return false

              // Priority filter: only HIGH or URGENT
              if (priorityFilter) {
                const priority = (b as any).priority || 'NORMAL'
                return priority === 'HIGH' || priority === 'URGENT'
              }
              return true
            })

            // Apply sort. Dashboard uses identical rules — keep
            // these two surfaces in sync when tweaking.
            if (sortBy === 'priority') {
              const priorityOrder: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 }
              filteredBatches.sort((a, b) => {
                const aPriority = (a as any).priority || 'NORMAL'
                const bPriority = (b as any).priority || 'NORMAL'
                const diff = priorityOrder[bPriority] - priorityOrder[aPriority]
                // Secondary sort by dueDate for same priority
                if (diff !== 0) return diff
                const aDate = a.dueDate ? new Date(a.dueDate.split('T')[0] + 'T00:00:00') : null
                const bDate = b.dueDate ? new Date(b.dueDate.split('T')[0] + 'T00:00:00') : null
                if (!aDate && !bDate) return 0
                if (!aDate) return 1
                if (!bDate) return -1
                return aDate.getTime() - bDate.getTime()
              })
            } else if (sortBy === 'dueDate') {
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              filteredBatches.sort((a, b) => {
                const aDate = a.dueDate ? new Date(a.dueDate.split('T')[0] + 'T00:00:00') : null
                const bDate = b.dueDate ? new Date(b.dueDate.split('T')[0] + 'T00:00:00') : null
                // Batches without a due date fall to the bottom.
                if (!aDate && !bDate) return 0
                if (!aDate) return 1
                if (!bDate) return -1
                // Overdue before not-overdue; within each group, ascending by date.
                const aOverdue = aDate < today
                const bOverdue = bDate < today
                if (aOverdue && !bOverdue) return -1
                if (!aOverdue && bOverdue) return 1
                return aDate.getTime() - bDate.getTime()
              })
            } else if (sortBy === 'progress') {
              filteredBatches.sort((a, b) => {
                const aProgress = a.steps.filter(s => s.status === 'COMPLETED').length / (a.steps.length || 1)
                const bProgress = b.steps.filter(s => s.status === 'COMPLETED').length / (b.steps.length || 1)
                return aProgress - bProgress // least complete first — “what still needs work”
              })
            }

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
              const priority = (batch as any).priority || 'NORMAL'
              const isUrgent = priority === 'URGENT'

              return (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className={`block bg-card border rounded-xl p-5 hover:border-primary/30 active:scale-[0.99] transition-all duration-150 ${
                    isUrgent ? 'border-l-4 border-l-red-500 border-t border-r border-b border-border' : 'border-border'
                  }`}
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
                    {priority === 'URGENT' && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 text-xs font-semibold">
                        <FlagIcon className="w-3 h-3" />
                        URGENT
                      </span>
                    )}
                    {priority === 'HIGH' && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
                        <FlagIcon className="w-3 h-3" />
                        HIGH
                      </span>
                    )}
                    {priority === 'LOW' && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                        <FlagIcon className="w-3 h-3" />
                        Low
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

                  {/* Inline notes preview (mobile-friendly — no hover needed) */}
                  {batch.notes && batch.notes.trim() && (
                    <div className="-mt-2 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-start gap-2">
                      <span aria-hidden="true" className="text-sm leading-none mt-0.5">📝</span>
                      <p className="text-xs text-foreground/90 line-clamp-2 break-words flex-1 min-w-0">{batch.notes}</p>
                    </div>
                  )}

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

      </main>
    </AppShell>
  )
}