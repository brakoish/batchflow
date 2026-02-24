import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Header from '@/app/components/Header'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  if (session.role !== 'OWNER') {
    redirect('/batches')
  }

  const [batches, activityLogs] = await Promise.all([
    prisma.batch.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        recipe: true,
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    }),
    prisma.progressLog.findMany({
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
        batchStep: {
          include: {
            batch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ])

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header session={session} />
      <div className="max-w-7xl mx-auto px-4 py-6 pb-safe">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-zinc-400">Welcome, {session.name}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Batches */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Active Batches
            </h2>
            {batches.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-12 border border-zinc-800 text-center">
                <p className="text-zinc-500 mb-4">No active batches</p>
                <Link
                  href="/batches/new"
                  className="inline-block px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
                >
                  Create First Batch
                </Link>
              </div>
            ) : (
              batches.map((batch) => {
                const completedSteps = batch.steps.filter(
                  (s) => s.status === 'COMPLETED'
                ).length
                const totalSteps = batch.steps.length

                return (
                  <Link
                    key={batch.id}
                    href={`/batches/${batch.id}`}
                    className="block bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-1">
                          {batch.name}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          {batch.recipe.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {batch.targetQuantity}
                        </div>
                        <div className="text-zinc-500 text-sm">target</div>
                      </div>
                    </div>

                    {/* Waterfall Progress */}
                    <div className="space-y-2">
                      {batch.steps.map((step) => {
                        const progress =
                          (step.completedQuantity / step.targetQuantity) * 100
                        const isLocked = step.status === 'LOCKED'
                        const isCompleted = step.status === 'COMPLETED'
                        const isInProgress = !isLocked && !isCompleted

                        return (
                          <div key={step.id}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`${
                                    isLocked
                                      ? 'text-zinc-500'
                                      : isCompleted
                                      ? 'text-green-400'
                                      : 'text-blue-400'
                                  } font-medium`}
                                >
                                  {step.order}. {step.name}
                                </span>
                                {isLocked && (
                                  <span className="text-zinc-600 text-xs">
                                    🔒
                                  </span>
                                )}
                              </div>
                              <span
                                className={`${
                                  isLocked
                                    ? 'text-zinc-500'
                                    : isCompleted
                                    ? 'text-green-400'
                                    : 'text-blue-400'
                                } text-xs`}
                              >
                                {(step as any).type === 'CHECK'
                                  ? (isCompleted ? '✅' : isLocked ? '🔒' : '⬚')
                                  : `${Math.round(progress)}% • ${step.completedQuantity} / ${step.targetQuantity}`
                                }
                              </span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  isLocked
                                    ? 'bg-zinc-700'
                                    : isCompleted
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{
                                  width: `${Math.min(progress, 100)}%`,
                                }}
                              />
                            </div>
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
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Recent Activity
            </h2>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              {activityLogs.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">
                  No activity yet
                </p>
              ) : (
                <div className="space-y-4">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="pb-4 border-b border-zinc-800 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-500 text-xs font-bold">
                            {log.worker.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">
                            <span className="font-semibold">
                              {log.worker.name}
                            </span>{' '}
                            logged{' '}
                            <span className="text-green-500 font-semibold">
                              +{log.quantity}
                            </span>
                          </p>
                          <p className="text-zinc-500 text-xs mt-1 truncate">
                            {log.batchStep.batch.name} •{' '}
                            {log.batchStep.name}
                          </p>
                          {log.note && (
                            <p className="text-zinc-400 text-xs mt-1">
                              "{log.note}"
                            </p>
                          )}
                          <p className="text-zinc-600 text-xs mt-1">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
