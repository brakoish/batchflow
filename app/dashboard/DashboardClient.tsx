'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/solid'
import EmptyState from '@/app/components/EmptyState'

type Session = { id: string; name: string; role: string }
type Step = { id: string; name: string; order: number; status: string; type?: string; completedQuantity: number; targetQuantity: number }
type Batch = {
  id: string; name: string; targetQuantity: number; status: string; strain?: string; dueDate?: string
  recipe: { name: string }; steps: Step[]
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
  initialBatches, initialActivity, session,
}: {
  initialBatches: Batch[]; initialActivity: ActivityLog[]; session: Session
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [activity, setActivity] = useState<ActivityLog[]>(initialActivity)
  const [workerSummary, setWorkerSummary] = useState<{ id: string; name: string; todayLogs: number; todayUnits: number; batches: string[]; onShift?: boolean; lastActivity?: string }[]>([])
  const [activeWorkers, setActiveWorkers] = useState(0)
  const [showCompleted, setShowCompleted] = useState(false)
  const [loading, setLoading] = useState(!initialBatches.length && !initialActivity.length)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const poll = async () => {
      try {
        const [bRes, aRes, wRes] = await Promise.all([
          fetch('/api/batches'),
          fetch('/api/activity'),
          fetch('/api/workers/activity'),
        ])
        if (bRes.ok) { const d = await bRes.json(); if (d.batches) { setBatches(d.batches); setLoading(false) } }
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
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  const totalUnits = activity.reduce((sum, l) => sum + (l.type === 'log' ? (l.quantity || 0) : 0), 0)

  return (
    <AppShell session={session}>

      <main className="max-w-5xl mx-auto px-4 py-5">
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
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
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
                const filteredBatches = batches
                  .filter(b => showCompleted || b.status === 'ACTIVE')
                  .filter((b) => {
                    const query = searchQuery.toLowerCase()
                    return (
                      b.name.toLowerCase().includes(query) ||
                      b.recipe.name.toLowerCase().includes(query) ||
                      (b.strain && b.strain.toLowerCase().includes(query))
                    )
                  })

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
                          {batch.dueDate && batch.status === 'ACTIVE' && new Date(batch.dueDate) < new Date() && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 font-semibold shrink-0">
                              OVERDUE
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

                    <div className="space-y-1.5">
                      {batch.steps.map((step) => {
                        const stepPct = (step.completedQuantity / step.targetQuantity) * 100
                        const isLocked = step.status === 'LOCKED'
                        const isCompleted = step.status === 'COMPLETED'
                        const isCheck = step.type === 'CHECK'

                        return (
                          <div key={step.id} className="flex items-center gap-3">
                            <div className="w-6 flex justify-center shrink-0">
                              {isCompleted ? (
                                <CheckCircleIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                              ) : isLocked ? (
                                <LockClosedIcon className="w-4 h-4 text-muted-foreground/30" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                              )}
                            </div>
                            <span className={`text-sm w-28 truncate shrink-0 ${
                              isLocked ? 'text-muted-foreground/40' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/80'
                            }`}>
                              {step.name}
                            </span>
                            <div className="flex-1">
                              {isCheck ? (
                                <span className={`text-xs ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : isLocked ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>
                                  {isCompleted ? 'Done' : 'Pending'}
                                </span>
                              ) : (
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isCompleted ? 'bg-emerald-500' : isLocked ? 'bg-muted' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(stepPct, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            {!isCheck && (
                              <span className={`text-xs tabular-nums shrink-0 ${
                                isLocked ? 'text-muted-foreground/30' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                              }`}>
                                {step.completedQuantity}/{step.targetQuantity}
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
    </AppShell>
  )
}