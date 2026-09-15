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
import {
  displayProductionStepName,
  getActiveStations,
  getLastBatchMovement,
  getStationStates,
  type ProductionLineLog,
} from '@/lib/productionLine'

type Step = { id: string; name: string; order: number; status: string; type?: string; completedQuantity: number; targetQuantity: number | null; unitRatio?: number; unitLabel?: string; progressLogs?: ProductionLineLog[] }
type Assignment = { worker: { id: string; name: string } }
type BatchPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type Batch = {
  id: string; name: string; targetQuantity: number | null; status: string; priority?: BatchPriority; strain?: string; dueDate?: string; notes?: string | null
  recipe: { name: string; brand?: string | null }; product?: { name: string; brand?: string | null } | null; steps: Step[]; assignments?: Assignment[]
  leadWorker?: { id: string; name: string } | null
}

export default function BatchListClient({
  initialBatches, session, organizationName, teamWorkerIds,
}: {
  initialBatches: Batch[]; session: Session; organizationName?: string; teamWorkerIds: string[]
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
  const [workFilter, setWorkFilter] = useState<'mine' | 'all' | 'unassigned'>(session.workerId ? 'mine' : 'all')
  const isWorker = session.role === 'WORKER'

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

  const isBatchReady = (batch: Batch) => getActiveStations(batch.steps, 1)[0]?.label !== 'waiting'
  const getBatchActivityTime = (batch: Batch) => {
    const lastMovement = getLastBatchMovement(batch.steps)
    return lastMovement ? new Date(lastMovement.createdAt).getTime() : 0
  }
  const isRecordedActiveBatch = (batch: Batch) => (
    batch.status === 'ACTIVE' && getStationStates(batch.steps).some(state => state.label === 'active')
  )
  const compareRecordedActiveFirst = (a: Batch, b: Batch) => {
    const activeDiff = Number(isRecordedActiveBatch(b)) - Number(isRecordedActiveBatch(a))
    if (activeDiff !== 0) return activeDiff

    const aTime = getBatchActivityTime(a)
    const bTime = getBatchActivityTime(b)
    if (!aTime && !bTime) return 0
    if (!aTime) return 1
    if (!bTime) return -1
    return bTime - aTime
  }
  const readyCount = batches.filter(isBatchReady).length

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
                className="bf-btn bf-btn-success"
              >
                {clockingIn ? 'Starting...' : 'Clock In'}
              </button>
              <button
                onClick={() => { haptic('light'); setNudgeDismissed(true) }}
                className="bf-icon-btn"
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
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-muted p-1">
            <span className="min-h-[44px] rounded-lg bg-card px-3 py-2.5 text-center text-sm font-semibold text-foreground shadow-sm">In Progress</span>
            <Link href="/stock" className="min-h-[44px] rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-muted-foreground">Current Stock</Link>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{isWorker ? 'Ready Now' : 'Your Batches'}</h1>
              <p className="text-muted-foreground mt-1">
                {isWorker
                  ? `${readyCount} ready · ${Math.max(0, batches.length - readyCount)} waiting`
                  : `${batches.length} available`}
              </p>
            </div>
            {!isWorker ? (
              <div className="flex items-center gap-2 shrink-0">
                {(session.role === 'OWNER' || session.role === 'SUPERVISOR') && <Link href="/history" className="bf-btn bf-btn-secondary">History</Link>}
                <Link href="/batches/new" className="bf-btn bf-btn-primary">New Batch</Link>
              </div>
            ) : onShift && (
              <div className="mt-1 flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                On shift
              </div>
            )}
          </div>

          {(!isWorker || batches.length > 5 || searchQuery) && (
          <div className="relative mt-4">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search batches..."
              className="w-full pl-10 pr-4 py-2.5 min-h-[48px] rounded-xl bg-muted/50 border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
          )}

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            {((session.workerId ? ['mine','all','unassigned'] : ['all','unassigned']) as ('mine'|'all'|'unassigned')[]).map(filter => <button key={filter} onClick={() => { haptic('light'); setWorkFilter(filter) }} className={`bf-select-btn shrink-0 ${workFilter===filter?'bf-select-btn-active':''}`}>{filter === 'mine' ? (session.role === 'SUPERVISOR' ? 'My Team' : 'My Work') : filter === 'all' ? 'All Work' : 'Unassigned'}</button>)}
          {!isWorker && <>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort batches"
              className="shrink-0 min-h-[44px] px-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            >
              <option value="priority">Sort: Priority</option>
              <option value="newest">Sort: Newest</option>
              <option value="dueDate">Sort: Due date</option>
              <option value="progress">Sort: Progress</option>
            </select>
            <button
              onClick={() => { haptic('light'); setPriorityFilter(!priorityFilter) }}
              className={`bf-select-btn shrink-0 ${
                priorityFilter
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400'
                  : ''
              }`}
            >
              <FlagIcon className="w-4 h-4" />
              High+
            </button>
          </>}
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
                (b.product?.name.toLowerCase().includes(query) ?? false) ||
                ((b.product?.brand || b.recipe.brand) && (b.product?.brand || b.recipe.brand)!.toLowerCase().includes(query)) ||
                (b.strain && b.strain.toLowerCase().includes(query))
              )
              if (!matchesSearch) return false

              const assignedToMeOrTeam = b.assignments?.some(a => a.worker.id === session.workerId || teamWorkerIds.includes(a.worker.id))
              if (workFilter === 'mine' && !assignedToMeOrTeam) return false
              if (workFilter === 'unassigned' && (b.assignments?.length || 0) > 0) return false

              if (priorityFilter) {
                const priority = b.priority || 'NORMAL'
                if (priority !== 'HIGH' && priority !== 'URGENT') return false
              }
              return true
            })

            // Apply sort. Dashboard uses identical rules — keep
            // these two surfaces in sync when tweaking.
            if (sortBy === 'priority') {
              const priorityOrder: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 }
              filteredBatches.sort((a, b) => {
                const aPriority = a.priority || 'NORMAL'
                const bPriority = b.priority || 'NORMAL'
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

            if (isWorker) {
              filteredBatches.sort((a, b) => {
                const readyDiff = Number(isBatchReady(b)) - Number(isBatchReady(a))
                if (readyDiff !== 0) return readyDiff
                return compareRecordedActiveFirst(a, b)
              })
            } else {
              filteredBatches.sort(compareRecordedActiveFirst)
            }

            if (filteredBatches.length === 0) {
              return searchQuery ? (
                <EmptyState icon="inbox" title="No batches match" description="Try a different search term." />
              ) : (
                <EmptyState icon="inbox" title="No batches" description="Check back later for new work." />
              )
            }

            const myBatches = filteredBatches
            const otherBatches: Batch[] = []
            const groupByBrand = (items: Batch[]) => {
              const groups = new Map<string, Batch[]>()
              for (const batch of items) {
                const brand = batch.product?.brand?.trim() || batch.recipe.brand?.trim() || 'Unassigned'
                groups.set(brand, [...(groups.get(brand) || []), batch])
              }
              return [...groups.entries()].sort(([a], [b]) => {
                if (a === 'Unassigned') return 1
                if (b === 'Unassigned') return -1
                return a.localeCompare(b)
              })
            }

            const renderBatch = (batch: Batch) => {
              const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length
              const priority = batch.priority || 'NORMAL'
              const isUrgent = priority === 'URGENT'
              const assignedNames = batch.assignments?.map(a => a.worker.name.split(' ')[0]) || []
              const cardBrand = batch.product?.brand?.trim() || batch.recipe.brand?.trim() || 'Unassigned'
              const cardProduct = batch.product?.name || batch.recipe.name
              const stepOverview = (
                <div className="mt-4 space-y-3 rounded-xl border border-border/60 p-3">
                  {batch.steps.map((step) => {
                    const skipped = step.name.startsWith('[Skipped] ')
                    const done = step.status === 'COMPLETED' && !skipped
                    const progress = skipped || done
                      ? 100
                      : step.targetQuantity
                        ? Math.min(100, Math.round((step.completedQuantity / step.targetQuantity) * 100))
                        : step.completedQuantity > 0 ? 100 : 0
                    const value = skipped
                      ? 'Skipped'
                      : step.type === 'CHECK'
                        ? done ? 'Done' : 'Not done'
                        : step.targetQuantity
                          ? `${step.completedQuantity.toLocaleString()} / ${step.targetQuantity.toLocaleString()} ${step.unitLabel || ''}`
                          : `${step.completedQuantity.toLocaleString()} ${step.unitLabel || ''} recorded`
                    return <div key={step.id}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className={`truncate font-semibold ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{displayProductionStepName(step)}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${skipped ? 'bg-muted-foreground/40' : done ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  })}
                </div>
              )

              if (isWorker) {
                const dueLabel = batch.dueDate ? (() => {
                  const due = new Date(batch.dueDate.split('T')[0] + 'T00:00:00')
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
                  if (days < 0) return `${Math.abs(days)}d overdue`
                  if (days === 0) return 'Due today'
                  if (days === 1) return 'Due tomorrow'
                  return `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                })() : null

                return (
                  <Link
                    key={batch.id}
                    href={`/batches/${batch.id}`}
                    className={`group block rounded-2xl border bg-card p-4 transition-colors active:bg-muted/35 ${
                      isUrgent ? 'border-l-4 border-l-red-500 border-y-border border-r-border' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-lg font-semibold text-foreground">{batch.name}</h2>
                          {(priority === 'URGENT' || priority === 'HIGH') && (
                            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                              priority === 'URGENT'
                                ? 'bg-red-500/10 text-red-500 dark:text-red-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>
                              {priority}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{cardBrand} · {cardProduct}</p>
                        <p className={`mt-1 truncate text-xs ${assignedNames.length ? 'text-muted-foreground' : 'font-semibold text-amber-600 dark:text-amber-400'}`}>{batch.leadWorker ? `Lead: ${batch.leadWorker.name.split(' ')[0]} · ` : ''}{assignedNames.length ? assignedNames.join(', ') : 'Needs team'}</p>
                      </div>
                      {dueLabel && (
                        <span className={`shrink-0 text-xs font-semibold ${dueLabel.includes('overdue') ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {dueLabel}
                        </span>
                      )}
                    </div>

                    {stepOverview}

                    <div className="mt-3 flex min-h-[44px] items-center justify-between border-t border-border/60 pt-3">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Open Batch</span>
                      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                )
              }

              return (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className={`group block rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-foreground/20 hover:bg-muted/20 active:bg-muted/35 ${
                    isUrgent ? 'border-l-4 border-l-red-500 border-t border-r border-b border-border' : 'border-border'
                  }`}
                >
                  {/* Top Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-foreground truncate">{batch.name}</h2>
                      <p className="text-sm text-muted-foreground">{cardBrand} · {cardProduct}</p>
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
                    <span className="bf-icon-btn min-h-[36px] min-w-[36px] shrink-0 ml-2 group-hover:bg-muted group-hover:text-foreground" aria-hidden="true">
                      <ChevronRightIcon className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {priority !== 'NORMAL' && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priority === 'URGENT' ? 'bg-red-500/10 text-red-500' : priority === 'HIGH' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>{priority}</span>}
                    <span className={`text-xs ${assignedNames.length ? 'text-muted-foreground' : 'font-semibold text-amber-600 dark:text-amber-400'}`}>{batch.leadWorker ? `Lead: ${batch.leadWorker.name.split(' ')[0]} · ` : ''}{assignedNames.length ? assignedNames.join(', ') : 'Needs team'}</span>
                  </div>

                  {/* Inline notes preview (mobile-friendly — no hover needed) */}
                  {batch.notes && batch.notes.trim() && (
                    <div className="-mt-2 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-start gap-2">
                      <span aria-hidden="true" className="text-sm leading-none mt-0.5">📝</span>
                      <p className="text-xs text-foreground/90 line-clamp-2 break-words flex-1 min-w-0">{batch.notes}</p>
                    </div>
                  )}

                  {stepOverview}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">{completedSteps}/{batch.steps.length} steps complete</p>
                    <span className="bf-btn bf-btn-primary bf-btn-sm shrink-0">
                      Open Batch
                      <ChevronRightIcon className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              )
            }

            return (
              <div className="space-y-7">
                {myBatches.length > 0 && (
                  <>
                    {groupByBrand(myBatches).map(([brand, brandBatches]) => {
                      const brandReady = isWorker ? brandBatches.filter(isBatchReady) : brandBatches
                      const brandWaiting = isWorker ? brandBatches.filter(b => !isBatchReady(b)) : []
                      return (
                        <section key={brand} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{brand}</h2>
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs tabular-nums text-muted-foreground">{brandBatches.length}</span>
                          </div>
                          {isWorker && brandReady.length > 0 && <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Ready to Touch</p>}
                          {brandReady.map(renderBatch)}
                          {isWorker && brandWaiting.length > 0 && <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waiting on Product</p>}
                          {brandWaiting.map(renderBatch)}
                        </section>
                      )
                    })}
                  </>
                )}
                {otherBatches.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-px bg-border" />
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Other Batches</h2>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {groupByBrand(otherBatches).map(([brand, brandBatches]) => (
                      <section key={brand} className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{brand}</h3>
                        {brandBatches.map(renderBatch)}
                      </section>
                    ))}
                  </>
                )}
              </div>
            )
        })()}

      </main>
    </AppShell>
  )
}
