import { summarizeBatchAssignments } from '@/lib/batchAssignmentSummary'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import BatchDetailClient from './BatchDetailClient'

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  const { id } = await params

  const [batch, organization] = await Promise.all([
    prisma.batch.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
      include: {
        recipe: true,
        product: true,
        variation: true,
        completionReport: true,
        steps: {
          orderBy: { order: 'asc' },
          include: {
            recipeStep: { select: { notes: true, materials: true } },
            progressLogs: {
              include: {
                worker: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        assignments: { include: { worker: { select: { id: true, name: true } } } },
        leadWorker: { select: { id: true, name: true } },
        removals: {
          include: { worker: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        materialEvents: {
          include: { worker: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { timezone: true },
    }),
  ])

  const workers = await prisma.worker.findMany({
    where: { role: { in: ['WORKER', 'SUPERVISOR'] }, organizationId: session.organizationId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  if (!batch) {
    redirect('/batches')
  }

  // Entry steps keep every weigh-in so the running total and each entry's
  // edit button match what the batch page shows after a refresh.
  const entryStepIds = batch.steps.filter(step => step.type === 'ENTRY').map(step => step.id)
  if (entryStepIds.length > 0) {
    const entryLogs = await prisma.progressLog.findMany({
      where: { batchStepId: { in: entryStepIds } },
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const step of batch.steps) {
      if (step.type === 'ENTRY') step.progressLogs = entryLogs.filter(log => log.batchStepId === step.id)
    }
  }

  const orgTimezone = organization?.timezone || 'America/New_York'

  return (
    <BatchDetailClient
      batch={JSON.parse(JSON.stringify((await summarizeBatchAssignments([batch], session.organizationId))[0]))}
      workers={JSON.parse(JSON.stringify(workers))}
      session={session}
      orgTimezone={orgTimezone}
    />
  )
}
