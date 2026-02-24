import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Header from '@/app/components/Header'
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/solid'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const [batches, activityLogs] = await Promise.all([
    prisma.batch.findMany({
      where: { status: 'ACTIVE' },
      include: { recipe: true, steps: { orderBy: { order: 'asc' } } },
      orderBy: { startDate: 'desc' },
    }),
    prisma.progressLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        worker: { select: { id: true, name: true } },
        batchStep: { include: { batch: { select: { id: true, name: true } } } },
      },
    }),
  ])

  const totalLogs = activityLogs.length
  const totalUnits = activityLogs.reduce((sum, l) => sum + l.quantity, 0)

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
          <span>{totalLogs} recent logs</span>
          <span className="text-zinc-800">·</span>
          <span>{totalUnits.toLocaleString()} units</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Batches */}
          <div className="lg:col-span-2 space-y-2.5">
            {batches.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                <p className="text-sm text-zinc-500 mb-3">No active batches</p>
                <Link
                  href="/batches/new"
                  className="inline-block px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                >
                  Create First Batch
                </Link>
              </div>
            ) : (
              batches.map((batch) => {
                const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length
                const pct = Math.round((completedSteps / batch.steps.length) * 100)

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

                    {/* Compact waterfall */}
                    <div className="space-y-1.5">
                      {batch.steps.map((step) => {
                        const stepPct = (step.completedQuantity / step.targetQuantity) * 100
                        const isLocked = step.status === 'LOCKED'
                        const isCompleted = step.status === 'COMPLETED'
                        const isCheck = (step as any).type === 'CHECK'

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
              {activityLogs.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">No activity yet</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-emerald-400">
                          {log.worker.name.charAt(0)}
                        </span>
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
          </div>
        </div>
      </main>
    </div>
  )
}
