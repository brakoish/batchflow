import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Header from '@/app/components/Header'
import RecipeBuilder from './RecipeBuilder'
import { CheckCircleIcon, HashtagIcon } from '@heroicons/react/24/solid'

export default async function RecipesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const recipes = await prisma.recipe.findMany({
    include: {
      steps: { orderBy: { order: 'asc' } },
      _count: { select: { batches: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-dvh bg-zinc-950">
      <Header session={session} />
      <main className="max-w-5xl mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50 mb-5">Recipes</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Existing */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Existing</h2>
            {recipes.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
                <p className="text-sm text-zinc-500">No recipes yet</p>
              </div>
            ) : (
              recipes.map((recipe) => (
                <div key={recipe.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-50">{recipe.name}</h3>
                      {recipe.description && (
                        <p className="text-xs text-zinc-500 mt-0.5">{recipe.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 tabular-nums">{recipe._count.batches} batches</span>
                  </div>
                  <div className="space-y-1">
                    {recipe.steps.map((step) => (
                      <div key={step.id} className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-600 tabular-nums w-4">{step.order}.</span>
                        <span className="text-zinc-300">{step.name}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${
                          (step as any).type === 'CHECK'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {(step as any).type === 'CHECK'
                            ? <><CheckCircleIcon className="w-2.5 h-2.5" />Check</>
                            : <><HashtagIcon className="w-2.5 h-2.5" />Count</>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <RecipeBuilder />
        </div>
      </main>
    </div>
  )
}
