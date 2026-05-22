import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import RecipesClient from './RecipesClient'

const BATCH_OVERRIDE_RECIPE_NAME = '__batchflow_batch_overrides'

export default async function RecipesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')

  const recipes = await prisma.recipe.findMany({
    where: { organizationId: session.organizationId, name: { not: BATCH_OVERRIDE_RECIPE_NAME } },
    include: {
      units: { orderBy: { order: 'asc' } },
      steps: { orderBy: { order: 'asc' }, include: { unit: true, materials: true } },
      _count: { select: { batches: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <AppShell session={session}>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground mb-5">Recipes</h1>
        <RecipesClient initialRecipes={JSON.parse(JSON.stringify(recipes))} />
      </main>
    </AppShell>
  )
}
