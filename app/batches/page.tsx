import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getOrganizationName } from '@/lib/organization'
import BatchListClient from './BatchListClient'

export default async function BatchesPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const organizationName = await getOrganizationName(session.organizationId)

  const where = { status: 'ACTIVE' as const, organizationId: session.organizationId }

  const [batches, memberships] = await Promise.all([prisma.batch.findMany({
    where,
    include: {
      recipe: true,
      product: true,
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
      leadWorker: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'desc' },
  }), session.workerId ? prisma.workTeamMember.findMany({
    where: { team: { organizationId: session.organizationId, members: { some: { workerId: session.workerId } } } },
    select: { workerId: true },
  }) : Promise.resolve([])])

  const teamWorkerIds = [...new Set(memberships.map((membership) => membership.workerId))]

  return (
    <BatchListClient
      initialBatches={JSON.parse(JSON.stringify(batches))}
      session={session}
      organizationName={organizationName || undefined}
      teamWorkerIds={teamWorkerIds}
    />
  )
}
