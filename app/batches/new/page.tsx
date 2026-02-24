import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import BatchCreator from './BatchCreator'

export default async function NewBatchPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const [recipes, workers] = await Promise.all([
    prisma.recipe.findMany({
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.worker.findMany({
      where: { role: 'WORKER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <AppShell session={session}>

      <main className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50 mb-5">New Batch</h1>

        {recipes.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
            <p className="text-sm text-zinc-500 mb-3">Create a recipe first</p>
            <Link
              href="/recipes"
              className="inline-block px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              Go to Recipes
            </Link>
          </div>
        ) : (
          <BatchCreator recipes={JSON.parse(JSON.stringify(recipes))} workers={JSON.parse(JSON.stringify(workers))} />
        )}
      </main>
    </AppShell>
  )
}
