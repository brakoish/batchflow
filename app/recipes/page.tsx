import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import RecipesClient from './RecipesClient'
import Link from 'next/link'
import { ArchiveBoxIcon } from '@heroicons/react/24/outline'

const BATCH_OVERRIDE_RECIPE_NAME = '__batchflow_batch_overrides'

export default async function RecipesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')

  const recipes = await prisma.recipe.findMany({
    where: {
      organizationId: session.organizationId,
      archivedAt: null,
      name: { not: BATCH_OVERRIDE_RECIPE_NAME },
    },
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
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Recipes</h1>
          <Link href="/recipes/archived" className="bf-btn bf-btn-secondary">
            <ArchiveBoxIcon className="h-4 w-4" />
            Archived
          </Link>
        </div>
        <RecipesClient initialRecipes={JSON.parse(JSON.stringify(recipes))} />
      </main>
    </AppShell>
  )
}
