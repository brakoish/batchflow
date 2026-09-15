import { redirect } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import ProductsManager from './ProductsManager'

export default async function ProductsPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')
  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, brand: true, archivedAt: true, recipe: { select: { name: true } } },
      orderBy: [{ brand: 'asc' }, { name: 'asc' }],
    }),
    prisma.brand.findMany({ where: { organizationId: session.organizationId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  return <AppShell session={session}><main className="mx-auto max-w-2xl px-4 py-5 pb-24"><ProductsManager initialProducts={JSON.parse(JSON.stringify(products))} initialBrands={brands} /></main></AppShell>
}
