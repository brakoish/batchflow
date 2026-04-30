'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { usePullToRefresh } from '@/app/components/usePullToRefresh'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import EmptyState from '@/app/components/EmptyState'
import EditBatchModal from '@/app/components/EditBatchModal'
import { emitBatchChanged, onBatchChanged } from '@/lib/batchEvents'
import type { Session } from '@/lib/session'
type Step = { id: string; name: string; order: number; status: string; type?: string; completedQuantity: number; targetQuantity: number | null }
type Batch = {
  id: string; name: string; targetQuantity: number | null; status: string; strain?: string; dueDate?: string; notes?: string | null
  lotNumber?: string; metrcBatchId?: string; packageTag?: string
  recipe: { name: string }; steps: Step[]; assignments?: { worker: { id: string; name: string } }[]
}
type ActivityLog = {
  id: string
  type: 'log' | 'edit' | 'delete'
  quantity?: number
  note?: string | null
  oldQuantity?: number | null
  newQuantity?: number | null
  oldNote?: string | null
  newNote?: string | null
  createdAt: string
  worker: { id: string; name: string }
  batchStep: { name: string; batch: { id: string; name: string } }
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function DashboardClient({
  initialBatches, initialActivity, session, organizationName,
}: {
  initialBatches: Batch[]; initialActivity: ActivityLog[]; session: Session; organizationName?: string
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [activity, setActivity] = useState<ActivityLog[]>(initialActivity)
  const [workerSummary, setWorkerSummary] = useState<{ id: string; name: string; todayLogs: number; todayUnits: number; batches: string[]; onShift?: boolean; lastActivity?: string }[]>([])
  const [activeWorkers, setActiveWorkers] = useState(0)
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(!initialBatches.length && !initialActivity.length)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'dueDate' | 'progress'>('newest')
  const [filterRecipe, setFilterRecipe] = useState('')
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [allWorkers, setAllWorkers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    // Fetch workers list for assignment
    fetch('/api/workers', { cache: "no-store" }).then(r => r.json()).then(d => {
      if (d.workers) setAllWorkers(d.workers.filter((w: any) => w.role === 'WORKER'))
    }).catch(() => {})
  }, [])

  const editingRef = useRef<string | null>(null)
  useEffect(() => { editingRef.current = editingBatch?.id || null }, [editingBatch])
  const lastSaveTsRef = useRef<number>(0)

  const poll = async (opts: { force?: boolean } = {}) => {
    // Skip list replacement while editing or just after a save to avoid
    // clobbering fresh local state with a stale read.
    const guarded = !opts.force && (editingRef.current || Date.now() - lastSaveTsRef.current < 3000)
    try {
      const [bRes, aRes, wRes] = await Promise.all([
        fetch('/api/batches', { cache: "no-store" }),
        fetch('/api/activity', { cache: "no-store" }),
        fetch('/api/workers/activity', { cache: "no-store" }),
      ])
      if (bRes.ok) {
        const d = await bRes.json()
        if (d.batches) {
          if (!guarded) setBatches(d.batches)
          setLoading(false)
        }
      }
      // Activity and worker summary are safe to refresh — they never
      // conflict with an open edit modal.
      if (aRes.ok) { const d = await aRes.json(); if (d.activities) setActivity(d.activities) }
      if (wRes.ok) {
        const d = await wRes.json();
        if (d.workers) {
          setWorkerSummary(d.workers)
          setActiveWorkers(d.workers.filter((w: any) => w.onShift).length)
        }
      }
    } catch {}
  }

  useEffect(() => {
    poll()
    // 15s safety-net polling; events cover the same-tab fast path
    const id = setInterval(() => poll(), 15000)
    const unsubscribe = onBatchChanged(() => poll({ force: true }))
    return () => {
      clearInterval(id)
      unsubscribe()
    }
  }, [])

  const { handlers: ptrHandlers } = usePullToRefresh(() => { setRefreshing(true); poll() }, 80)

  const totalUnits = activity.reduce((sum, l) => sum + (l.type === 'log' ? (l.quantity || 0) : 0), 0)

  // Extract unique recipe names for filter dropdown
  const uniqueRecipes = Array.from(new Set(batches.map(b => b.recipe.name))).sort()

  // Apply filtering and sorting
  const getFilteredAndSortedBatches = () => {
    let filtered = batches
      .filter(b => showCompleted || b.status === 'ACTIVE')
      .filter((b) => {
        const query = searchQuery.toLowerCase()
        return (
          b.name.toLowerCase().includes(query) ||
          b.recipe.name.toLowerCase().includes(query) ||
          (b.strain && b.strain.toLowerCase().includes(query))
        )
      })

    // Apply recipe filter
    if (filterRecipe) {
      filtered = filtered.filter(b => b.recipe.name === filterRecipe)
    }

    // Apply sorting
    if (sortBy === 'dueDate') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      filtered.sort((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate.split('T')[0] + 'T00:00:00') : null
        const bDate = b.dueDate ? new Date(b.dueDate.split('T')[0] + 'T00:00:00') : null

        // No due date goes to bottom
        if (!aDate && !bDate) return 0
        if (!aDate) return 1
        if (!bDate) return -1

        // Overdue first (ascending by how overdue)
        const aOverdue = aDate < today
        const bOverdue = bDate < today

        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1

        // Both overdue or both not overdue: sort by date ascending
        return aDate.getTime() - bDate.getTime()
      })
    } else if (sortBy === 'progress') {
      filtered.sort((a, b) => {
        const aProgress = a.steps.filter(s => s.status === 'COMPLETED').length / a.steps.length
        const bProgress = b.steps.filter(s => s.status === 'COMPLETED').length / b.steps.length
        return aProgress - bProgress // Least complete first
      })
    }
    // 'newest' keeps the default order from API

    return filtered
  }

  return (
    <AppShell session={session} organizationName={organizationName}>

      <main
        className="max-w-5xl mx-auto px-4 py-5"
        {...ptrHandlers}
      >
        {/* Pull to refresh indicator */}
        {refreshing && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          </div>
        )}
        {/* Stats */}
        <div className="mb-5 space-y-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="text-foreground font-semibold text-lg tracking-tight">Dashboard</span>
            <span className="text-border">|</span>
            <span>{batches.filter(b => b.status === 'ACTIVE').length} active batches</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeWorkers} on shift today
            </span>
            <span className="text-border">·</span>
            <span>{totalUnits.toLocaleString()} units</span>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search batches..."
              className="w-full pl-10 pr-4 py-2 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Filter and Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Recipe Filter */}
            <select
              value={filterRecipe}
              onChange={(e) => setFilterRecipe(e.target.value)}
              className="flex-1 px-3 py-2.5 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
            >
              <option value="">All Recipes</option>
              {uniqueRecipes.map((recipe) => (
                <option key={recipe} value={recipe}>{recipe}</option>
              ))}
            </select>

            {/* Sort Pills */}
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setSortBy('newest')}
                className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  sortBy === 'newest'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => setSortBy('dueDate')}
                className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  sortBy === 'dueDate'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
              >
                Due Date
              </button>
              <button
                onClick={() => setSortBy('progress')}
                className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  sortBy === 'progress'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
              >
                Progress
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Batches */}
          <div className="lg:col-span-2 space-y-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Batches</h2>
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
                ))}
              </>
            ) : (() => {
                const filteredBatches = getFilteredAndSortedBatches()

                if (filteredBatches.length === 0) {
                  return searchQuery ? (
                    <EmptyState icon="clipboard" title="No batches match" description="Try a different search term." />
                  ) : (
                    <EmptyState icon="clipboard" title={showCompleted ? "No batches" : "No active batches"} description={showCompleted ? "No batches found." : "Start your first production run"} actionLabel={!showCompleted ? "Create Batch" : undefined} actionHref="/batches/new" />
                  )
                }

                return filteredBatches.map((batch) => {
                const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length

                return (
                  <Link
                    key={batch.id}
                    href={`/batches/${batch.id}`}
                    className="block rounded-xl border border-border bg-card p-4 hover:border-input hover:translate-y-[-1px] active:scale-[0.99] transition-all duration-150"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-foreground truncate">{batch.name}</h3>
                          {batch.strain && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                              {batch.strain}
                            </span>
                          )}
                          {batch.notes && batch.notes.trim() && (
                            <span
                              aria-label="Has notes"
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium shrink-0"
                            >
                              📝
                            </span>
                          )}
                          {batch.dueDate && batch.status === 'ACTIVE' && new Date(batch.dueDate) < new Date() && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 font-semibold shrink-0">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{batch.recipe.name}</p>
                        {batch.notes && batch.notes.trim() && (
                          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 line-clamp-1 break-words">
                            📝 {batch.notes}
                          </p>
                        )}
                        {batch.dueDate && (() => {
                          const due = new Date(batch.dueDate.split('T')[0] + 'T00:00:00')
                          const now = new Date()
                          now.setHours(0, 0, 0, 0)
                          const daysLeft = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                          const isOverdue = batch.status === 'ACTIVE' && daysLeft < 0
                          const isSoon = batch.status === 'ACTIVE' && daysLeft >= 0 && daysLeft <= 2
                          return (
                            <p className={`text-[10px] font-medium ${
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
                        {batch.assignments && batch.assignments.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex -space-x-1">
                              {batch.assignments.slice(0, 4).map((a) => (
                                <div key={a.worker.id} className="w-5 h-5 rounded-full bg-muted border border-card flex items-center justify-center" title={a.worker.name}>
                                  <span className="text-[8px] font-semibold text-muted-foreground">{a.worker.name.charAt(0)}</span>
                                </div>
                              ))}
                              {batch.assignments.length > 4 && (
                                <div className="w-5 h-5 rounded-full bg-muted border border-card flex items-center justify-center">
                                  <span className="text-[8px] font-semibold text-muted-foreground">+{batch.assignments.length - 4}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">{batch.assignments.map(a => a.worker.name.split(' ')[0]).join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-start gap-2 ml-4 shrink-0">
                        <div className="text-right">
                          <span className="text-lg font-bold tabular-nums text-foreground">{batch.targetQuantity ?? <span className="text-sm text-blue-500 font-semibold">Open</span>}</span>
                          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">target</p>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingBatch(batch) }}
                          className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Edit batch"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {batch.steps.map((step) => {
                        const stepPct = step.targetQuantity ? (step.completedQuantity / step.targetQuantity) * 100 : 0
                        const isCompleted = step.status === 'COMPLETED'
                        const isCheck = step.type === 'CHECK'

                        return (
                          <div key={step.id} className="flex items-center gap-3">
                            <div className="w-6 flex justify-center shrink-0">
                              {isCompleted ? (
                                <CheckCircleIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                              )}
                            </div>
                            <span className={`text-sm w-28 truncate shrink-0 ${
                              isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'
                            }`}>
                              {step.name}
                            </span>
                            <div className="flex-1">
                              {isCheck ? (
                                <span className={`text-xs ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                  {isCompleted ? 'Done' : 'Pending'}
                                </span>
                              ) : (
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(stepPct, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            {!isCheck && (
                              <span className={`text-xs tabular-nums shrink-0 ${
                                isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                              }`}>
                                {step.completedQuantity}{step.targetQuantity ? `/${step.targetQuantity}` : ' produced'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Link>
                )
              })
            })()}
          </div>

          {/* Activity Feed */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-8">No activity yet</p>
              ) : (
                activity.slice(0, 10).map((item) => {
                  const isLog = item.type === 'log'
                  const isEdit = item.type === 'edit'
                  const isDelete = item.type === 'delete'

                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isLog ? 'bg-emerald-500/10' : 'bg-muted'
                        }`}>
                          {isLog ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{item.worker.name.charAt(0)}</span>
                          ) : isEdit ? (
                            <span className="text-[10px]">✏️</span>
                          ) : (
                            <span className="text-[10px]">🗑</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground/80">
                            <span className="font-medium text-foreground">{item.worker.name}</span>
                            {isLog && (
                              <>
                                {' '}logged{' '}
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">+{item.quantity}</span>
                              </>
                            )}
                            {isEdit && (
                              <>
                                {' '}edited {item.batchStep.name}:{' '}
                                <span className="text-muted-foreground/70 tabular-nums">{item.oldQuantity}</span>
                                {' → '}
                                <span className="text-blue-600 dark:text-blue-400 font-semibold tabular-nums">{item.newQuantity}</span>
                              </>
                            )}
                            {isDelete && (
                              <>
                                {' '}deleted{' '}
                                <span className="text-red-500 dark:text-red-400 font-semibold tabular-nums">+{item.oldQuantity}</span>
                                {' '}from {item.batchStep.name}
                              </>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                            {item.batchStep.batch.name} · {timeAgo(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Worker Summary */}
            {workerSummary.length > 0 && (
              <div className="mt-5">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today&apos;s Team</h2>
                <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
                  {workerSummary.map((w) => (
                    <div key={w.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${w.onShift ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                          <span className={`text-[10px] font-bold ${w.onShift ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{w.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-foreground">{w.name}</p>
                            {w.onShift && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          </div>
                          {w.batches.length > 0 && (
                            <p className="text-[10px] text-muted-foreground/60 truncate max-w-[150px]">{w.batches.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {w.todayLogs > 0 ? (
                          <>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{w.todayUnits} units</p>
                            <p className="text-[10px] text-muted-foreground/60 tabular-nums">{w.todayLogs} logs · {w.lastActivity ? timeAgo(w.lastActivity) : 'no activity'}</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40">No activity</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <EditBatchModal
        batch={editingBatch}
        workers={allWorkers}
        onClose={() => setEditingBatch(null)}
        onSaved={(updated) => {
          setBatches(prev => prev.map(b => b.id === updated.id ? updated as Batch : b))
          lastSaveTsRef.current = Date.now()
          // Force a full refetch to ensure steps are in sync
          fetch('/api/batches', { cache: "no-store" })
            .then(res => res.ok ? res.json() : null)
            .then(fresh => { if (fresh?.batches) setBatches(fresh.batches) })
            .catch(() => {})
          emitBatchChanged(updated.id, 'dashboard-edit')
        }}
      />
    </AppShell>
  )
}