'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/solid'

type Session = { id: string; name: string; role: string }
type Step = { id: string; name: string; order: number; status: string; type?: string; completedQuantity: number; targetQuantity: number }
type Batch = {
  id: string; name: string; targetQuantity: number; status: string
  recipe: { name: string }; steps: Step[]
}
type ActivityLog = {
  id: string; quantity: number; note: string | null; createdAt: string
  worker: { id: string; name: string }
  batchStep: { name: string; batch: { id: string; name: string } }
}

export default function DashboardClient({
  initialBatches, initialActivity, session,
}: {
  initialBatches: Batch[]; initialActivity: ActivityLog[]; session: Session
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [activity, setActivity] = useState(initialActivity)
  const [workerSummary, setWorkerSummary] = useState<{ id: string; name: string; todayLogs: number; todayUnits: number; batches: string[] }[]>([])

  useEffect(() => {
    const poll = async () => {
      try {
        const [bRes, aRes, wRes] = await Promise.all([
          fetch('/api/batches'),
          fetch('/api/activity'),
          fetch('/api/workers/activity'),
        ])
        if (bRes.ok) { const d = await bRes.json(); if (d.batches) setBatches(d.batches) }
        if (aRes.ok) { const d = await aRes.json(); if (d.logs) setActivity(d.logs) }
        if (wRes.ok) { const d = await wRes.json(); if (d.workers) setWorkerSummary(d.workers) }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  const totalUnits = activity.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <div className="min-h-dvh bg-zinc-950">
      <Header session={session} />
      <main className="max-w-5xl mx-auto px-4 py-5">
        {/* Stats */}
        <div className="flex items-center gap-4 mb-5 text-xs text-zinc-500">
          <span className="text-zinc-50 font-semibold text-lg tracking-tight">Dashboard</span>
          <span className="text-zinc-800">|</span>
          <span>{batches.length} active</span>
          <span className="text-zinc-800">·</span>
          <span>{activity.length} recent logs</span>
          <span className="text-zinc-800">·</span>
          <span>{totalUnits.toLocaleString()} units</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Batches */}
          <div className="lg:col-span-2 space-y-2.5">
            {batches.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                <p className="text-sm text-zinc-500 mb-3">No active batches</p>
                <Link href="/batches/new" className="inline-block px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
                  Create First Batch
                </Link>
              </div>
            ) : (
              batches.map((batch) => {
                const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length

                return (
                  <Link
                    key={batch.id}
                    href={`/batches/${batch.id}`}
                    className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:translate-y-[-1px] active:scale-[0.99] transition-all duration-150"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-50">{batch.name}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{batch.recipe.name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold tabular-nums text-zinc-50">{batch.targetQuantity}</span>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">target</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {batch.steps.map((step) => {
                        const stepPct = (step.completedQuantity / step.targetQuantity) * 100
                        const isLocked = step.status === 'LOCKED'
                        const isCompleted = step.status === 'COMPLETED'
                        const isCheck = step.type === 'CHECK'

                        return (
                          <div key={step.id} className="flex items-center gap-2.5">
                            <div className="w-4 flex justify-center shrink-0">
                              {isCompleted ? (
                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                              ) : isLocked ? (
                                <LockClosedIcon className="w-3 h-3 text-zinc-700" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              )}
                            </div>
                            <span className={`text-xs w-28 truncate shrink-0 ${
                              isLocked ? 'text-zinc-600' : isCompleted ? 'text-emerald-400' : 'text-zinc-300'
                            }`}>
                              {step.name}
                            </span>
                            <div className="flex-1">
                              {isCheck ? (
                                <span className={`text-[10px] ${isCompleted ? 'text-emerald-400' : isLocked ? 'text-zinc-700' : 'text-zinc-500'}`}>
                                  {isCompleted ? 'Done' : 'Pending'}
                                </span>
                              ) : (
                                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isCompleted ? 'bg-emerald-500' : isLocked ? 'bg-zinc-800' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(stepPct, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            {!isCheck && (
                              <span className={`text-[10px] tabular-nums shrink-0 ${
                                isLocked ? 'text-zinc-700' : isCompleted ? 'text-emerald-400' : 'text-zinc-500'
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
            )}
          </div>

          {/* Activity Feed */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Activity</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
              {activity.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">No activity yet</p>
              ) : (
                activity.map((log) => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-emerald-400">{log.worker.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-300">
                          <span className="font-medium text-zinc-50">{log.worker.name}</span>
                          {' '}logged{' '}
                          <span className="text-emerald-400 font-semibold tabular-nums">+{log.quantity}</span>
                        </p>
                        <p className="text-[10px] text-zinc-600 truncate mt-0.5">
                          {log.batchStep.batch.name} · {log.batchStep.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Worker Summary */}
            {workerSummary.length > 0 && (
              <div className="mt-5">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Today&apos;s Team</h2>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
                  {workerSummary.map((w) => (
                    <div key={w.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-blue-400">{w.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-50">{w.name}</p>
                          {w.batches.length > 0 && (
                            <p className="text-[10px] text-zinc-600 truncate max-w-[150px]">{w.batches.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {w.todayLogs > 0 ? (
                          <>
                            <p className="text-xs text-emerald-400 font-semibold tabular-nums">{w.todayUnits} units</p>
                            <p className="text-[10px] text-zinc-600 tabular-nums">{w.todayLogs} logs</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-zinc-700">No activity</p>
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
    </div>
  )
}
