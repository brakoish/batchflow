import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Header from '@/app/components/Header'

export default async function BatchesPage() {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  const batches = await prisma.batch.findMany({
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
  })

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header session={session} />
      <div className="max-w-4xl mx-auto px-4 py-6 pb-safe">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            Active Batches
          </h1>
          <p className="text-zinc-400">Welcome, {session.name}</p>
        </div>

        {/* Batch List */}
        {batches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-lg">No active batches</p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => {
              const firstIncompleteStep = batch.steps.find(
                (step) => step.status !== 'COMPLETED'
              )
              const completedSteps = batch.steps.filter(
                (step) => step.status === 'COMPLETED'
              ).length
              const totalSteps = batch.steps.length

              return (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className="block bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white mb-1">
                        {batch.name}
                      </h2>
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

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-zinc-400">
                        {completedSteps} of {totalSteps} steps
                      </span>
                      <span className="text-zinc-400">
                        {Math.round((completedSteps / totalSteps) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 transition-all"
                        style={{
                          width: `${(completedSteps / totalSteps) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Current Step */}
                  {firstIncompleteStep && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500">Current:</span>
                      <span className="text-white font-medium">
                        {firstIncompleteStep.name}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400">
                        {firstIncompleteStep.completedQuantity} /{' '}
                        {firstIncompleteStep.targetQuantity}
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
