import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import BatchCreator from './BatchCreator'

const BATCH_OVERRIDE_RECIPE_NAME = '__batchflow_batch_overrides'

export default async function NewBatchPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')

  const [recipes, workers] = await Promise.all([
    prisma.recipe.findMany({
      where: { organizationId: session.organizationId, name: { not: BATCH_OVERRIDE_RECIPE_NAME } },
      select: { id: true, name: true, description: true, baseUnit: true, steps: { orderBy: { order: 'asc' }, select: { id: true, name: true, order: true, notes: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.worker.findMany({
      where: { role: { in: ['WORKER', 'SUPERVISOR'] }, organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <AppShell session={session}>

      <main className="max-w-lg mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground mb-5">New Batch</h1>

        {recipes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">Create a recipe first</p>
            <Link
              href="/recipes"
              className="bf-btn bf-btn-success"
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
