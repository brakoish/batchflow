import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Header from '@/app/components/Header'

export default async function BatchesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role === 'OWNER') redirect('/dashboard')

  const batches = await prisma.batch.findMany({
    where: { status: 'ACTIVE' },
    include: {
      recipe: true,
      steps: { orderBy: { order: 'asc' } },
    },
    orderBy: { startDate: 'desc' },
  })

  return (
    <div className="min-h-dvh bg-zinc-950">
      <Header session={session} />
      <main className="max-w-2xl mx-auto px-4 py-5">
        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">Active Batches</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{batches.length} batch{batches.length !== 1 ? 'es' : ''} in progress</p>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500">No active batches</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {batches.map((batch) => {
              const firstIncomplete = batch.steps.find((s) => s.status !== 'COMPLETED')
              const completedSteps = batch.steps.filter((s) => s.status === 'COMPLETED').length
              const totalSteps = batch.steps.length
              const pct = Math.round((completedSteps / totalSteps) * 100)

              return (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:translate-y-[-1px] active:scale-[0.99] transition-all duration-150"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-zinc-50 truncate">{batch.name}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{batch.recipe.name}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <span className="text-lg font-bold tabular-nums text-zinc-50">{batch.targetQuantity}</span>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">target</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2.5">
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-zinc-500">{completedSteps}/{totalSteps} steps</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-400">{pct}%</span>
                    </div>
                    {firstIncomplete && (
                      <span className="text-xs text-blue-400 font-medium">
                        {firstIncomplete.name}: {firstIncomplete.completedQuantity}/{firstIncomplete.targetQuantity}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
