import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import ManageBatchClient from './ManageBatchClient'

export default async function ManageBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ duplicate?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')

  const { id } = await params
  const query = await searchParams
  const [batch, workers] = await Promise.all([
    prisma.batch.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        recipe: { select: { id: true, name: true } },
        assignments: { include: { worker: { select: { id: true, name: true } } } },
        steps: { orderBy: { order: 'asc' } },
      },
    }),
    prisma.worker.findMany({
      where: { organizationId: session.organizationId, role: { in: ['WORKER', 'SUPERVISOR'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!batch) redirect('/batches')

  return (
    <ManageBatchClient
      initialBatch={JSON.parse(JSON.stringify(batch))}
      workers={workers}
      session={session}
      duplicate={query.duplicate === '1'}
    />
  )
}
