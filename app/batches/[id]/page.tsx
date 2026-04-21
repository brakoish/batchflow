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
    prisma.batch.findUnique({
      where: { id },
      include: {
        recipe: true,
        steps: {
          orderBy: { order: 'asc' },
          include: {
            recipeStep: { select: { notes: true } },
            progressLogs: {
              include: {
                worker: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
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

  return (
    <BatchDetailClient
      batch={JSON.parse(JSON.stringify(batch))}
      workers={JSON.parse(JSON.stringify(workers))}
      session={session}
    />
  )
}
