import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArchiveBoxIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import AppShell from '@/app/components/AppShell'
import EmptyState from '@/app/components/EmptyState'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getOrganizationName } from '@/lib/organization'
import { getProducedBaseUnits, getRemovedQuantity } from '@/lib/inventory'

type StockBatch = {
  id: string
  name: string
  baseUnit: string
  status: string
  recipe: { id: string; name: string; brand: string | null }
  steps: { name: string; order: number; type: string; completedQuantity: number; unitRatio: number }[]
  removals: { quantity: number }[]
}

type ProductStock = {
  recipeId: string
  product: string
  brand: string
  baseUnit: string
  produced: number
  removed: number
  onHand: number
  batches: { id: string; name: string; onHand: number; status: string }[]
}

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const [organizationName, batches] = await Promise.all([
    getOrganizationName(session.organizationId),
    prisma.batch.findMany({
      where: { organizationId: session.organizationId },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        status: true,
        recipe: { select: { id: true, name: true, brand: true } },
        steps: {
          orderBy: { order: 'asc' },
          select: { name: true, order: true, type: true, completedQuantity: true, unitRatio: true },
        },
        removals: { select: { quantity: true } },
      },
      orderBy: { startDate: 'desc' },
    }),
  ])

  const products = new Map<string, ProductStock>()
  for (const batch of batches as StockBatch[]) {
    const produced = getProducedBaseUnits(batch.steps)
    const removed = getRemovedQuantity(batch.removals)
    if (produced === 0 && removed === 0) continue

    const brand = batch.recipe.brand?.trim() || 'Unassigned'
    const current = products.get(batch.recipe.id) || {
      recipeId: batch.recipe.id,
      product: batch.recipe.name,
      brand,
      baseUnit: batch.baseUnit,
      produced: 0,
      removed: 0,
      onHand: 0,
      batches: [],
    }
    const batchOnHand = Math.max(0, produced - removed)
    current.produced += produced
    current.removed += removed
    current.onHand += batchOnHand
    if (batchOnHand > 0) current.batches.push({ id: batch.id, name: batch.name, onHand: batchOnHand, status: batch.status })
    products.set(batch.recipe.id, current)
  }

  const inStock = [...products.values()]
    .filter((product) => product.onHand > 0)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.product.localeCompare(b.product))
  const grouped = new Map<string, ProductStock[]>()
  for (const product of inStock) {
    grouped.set(product.brand, [...(grouped.get(product.brand) || []), product])
  }

  return (
    <AppShell session={session} organizationName={organizationName || undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-muted p-1">
          <Link href="/batches" className="min-h-[44px] rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-muted-foreground">In Progress</Link>
          <span className="min-h-[44px] rounded-lg bg-card px-3 py-2.5 text-center text-sm font-semibold text-foreground shadow-sm">Current Stock</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Current Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">Finished product on hand, grouped by brand.</p>
        </div>

        {grouped.size === 0 ? (
          <EmptyState icon="inbox" title="No finished stock yet" description="Finished output will appear here as workers record production." />
        ) : (
          <div className="space-y-7">
            {[...grouped.entries()].map(([brand, brandProducts]) => (
              <section key={brand}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{brand}</h2>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3">
                  {brandProducts.map((product) => (
                    <div key={product.recipeId} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-foreground">{product.product}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{product.batches.length} batch{product.batches.length === 1 ? '' : 'es'} holding stock</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{product.onHand.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{product.baseUnit} on hand</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                        <div><p className="text-sm font-bold tabular-nums text-foreground">{product.produced.toLocaleString()}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Produced</p></div>
                        <div><p className="text-sm font-bold tabular-nums text-foreground">{product.removed.toLocaleString()}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Removed</p></div>
                      </div>
                      <div className="mt-3 space-y-1">
                        {product.batches.map((batch) => (
                          <Link key={batch.id} href={`/batches/${batch.id}`} className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-muted/40 active:bg-muted/60">
                            <span className="min-w-0 truncate text-muted-foreground">{batch.name}</span>
                            <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums text-foreground">{batch.onHand.toLocaleString()} <ChevronRightIcon className="h-4 w-4 text-muted-foreground" /></span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {grouped.has('Unassigned') && (session.role === 'OWNER' || session.role === 'SUPERVISOR') && (
          <Link href="/recipes" className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-medium text-amber-700 dark:text-amber-300">
            <ArchiveBoxIcon className="h-5 w-5 shrink-0" />
            Assign brands in Recipes to finish organizing this stock.
          </Link>
        )}
      </main>
    </AppShell>
  )
}
