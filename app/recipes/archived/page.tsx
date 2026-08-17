import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import ArchivedRecipesClient from './ArchivedRecipesClient'

export default async function ArchivedRecipesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')

  const recipes = await prisma.recipe.findMany({
    where: {
      organizationId: session.organizationId,
      archivedAt: { not: null },
    },
    select: {
      id: true,
      name: true,
      description: true,
      archivedAt: true,
      _count: { select: { batches: true } },
    },
    orderBy: { archivedAt: 'desc' },
  })

  return (
    <AppShell session={session}>
      <main className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/recipes" className="bf-icon-btn" aria-label="Back to recipes">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Archived Recipes</h1>
            <p className="text-xs text-muted-foreground">Restore a recipe to use it in new batches again.</p>
          </div>
        </div>
        <ArchivedRecipesClient initialRecipes={JSON.parse(JSON.stringify(recipes))} />
      </main>
    </AppShell>
  )
}
