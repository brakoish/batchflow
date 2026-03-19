import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getOrganizationName } from '@/lib/organization'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const organizationName = await getOrganizationName(session.organizationId)

  const batches = await prisma.batch.findMany({
    where: {
      status: 'ACTIVE',
      organizationId: session.organizationId,
    },
    include: { recipe: true, steps: { orderBy: { order: 'asc' } } },
    orderBy: { startDate: 'desc' },
  })

  // Fetch both progress logs and audit logs
  const [progressLogs, auditLogs] = await Promise.all([
    prisma.progressLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        worker: { select: { id: true, name: true } },
        batchStep: { include: { batch: { select: { id: true, name: true } } } },
      },
    }),
    prisma.logAudit.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        action: {
          in: ['edit', 'delete'],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        worker: { select: { id: true, name: true } },
        batchStep: { include: { batch: { select: { id: true, name: true } } } },
      },
    }),
  ])

  // Transform and merge activities
  const logActivities = progressLogs.map((log) => ({
    id: log.id,
    type: 'log' as const,
    createdAt: log.createdAt,
    worker: log.worker,
    batchStep: log.batchStep,
    quantity: log.quantity,
    note: log.note,
  }))

  const auditActivities = auditLogs.map((audit) => ({
    id: audit.id,
    type: audit.action as 'edit' | 'delete',
    createdAt: audit.createdAt,
    worker: audit.worker,
    batchStep: audit.batchStep,
    oldQuantity: audit.oldQuantity,
    newQuantity: audit.newQuantity,
    oldNote: audit.oldNote,
    newNote: audit.newNote,
  }))

  const allActivities = [...logActivities, ...auditActivities]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15)

  return (
    <DashboardClient
      initialBatches={JSON.parse(JSON.stringify(batches))}
      initialActivity={JSON.parse(JSON.stringify(allActivities))}
      session={session}
      organizationName={organizationName || undefined}
    />
  )
}
