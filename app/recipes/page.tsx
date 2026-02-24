import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import RecipeBuilder from './RecipeBuilder'

export default async function RecipesPage() {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  if (session.role !== 'OWNER') {
    redirect('/batches')
  }

  const recipes = await prisma.recipe.findMany({
    include: {
      steps: {
        orderBy: {
          order: 'asc',
        },
      },
      _count: {
        select: {
          batches: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center text-zinc-400 hover:text-white mb-4 text-sm"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-white">Recipes</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recipe List */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Existing Recipes
            </h2>
            {recipes.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
                <p className="text-zinc-500">No recipes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {recipe.name}
                        </h3>
                        {recipe.description && (
                          <p className="text-zinc-400 text-sm">
                            {recipe.description}
                          </p>
                        )}
                      </div>
                      <span className="text-zinc-500 text-sm">
                        {recipe._count.batches} batches
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 font-medium mb-2">
                        Steps ({recipe.steps.length}):
                      </p>
                      {recipe.steps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="text-zinc-600 font-medium">
                            {step.order}.
                          </span>
                          <div className="flex-1">
                            <span className="text-zinc-300">{step.name}</span>
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${(step as any).type === 'CHECK' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'}`}>
                              {(step as any).type === 'CHECK' ? '✅' : '🔢'}
                            </span>
                            {step.notes && (
                              <p className="text-zinc-500 text-xs mt-0.5">
                                {step.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recipe Builder */}
          <RecipeBuilder />
        </div>
      </div>
    </div>
  )
}
