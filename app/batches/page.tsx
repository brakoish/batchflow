import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getOrganizationName } from '@/lib/organization'
import BatchListClient from './BatchListClient'

export default async function BatchesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role === 'OWNER') redirect('/dashboard')

  const organizationName = await getOrganizationName(session.organizationId)

  const where =
    session.role === 'WORKER' && session.workerId
      ? {
          status: 'ACTIVE' as const,
          organizationId: session.organizationId,
          OR: [
            { assignments: { none: {} } },
            { assignments: { some: { workerId: session.workerId } } },
          ],
        }
      : {
          status: 'ACTIVE' as const,
          organizationId: session.organizationId,
        }

  const batches = await prisma.batch.findMany({
    where,
    include: {
      recipe: true,
      steps: {
        orderBy: { order: 'asc' },
        include: {
          progressLogs: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: { worker: { select: { id: true, name: true } } },
          },
        },
      },
      assignments: { include: { worker: { select: { id: true, name: true } } } },
    },
    orderBy: { startDate: 'desc' },
  })

  return (
    <BatchListClient
      initialBatches={JSON.parse(JSON.stringify(batches))}
      session={session}
      organizationName={organizationName || undefined}
    />
  )
}
