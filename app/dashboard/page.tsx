import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const [batches, activityLogs] = await Promise.all([
    prisma.batch.findMany({
      where: { status: 'ACTIVE' },
      include: { recipe: true, steps: { orderBy: { order: 'asc' } } },
      orderBy: { startDate: 'desc' },
    }),
    prisma.progressLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        worker: { select: { id: true, name: true } },
        batchStep: { include: { batch: { select: { id: true, name: true } } } },
      },
    }),
  ])

  return (
    <DashboardClient
      initialBatches={JSON.parse(JSON.stringify(batches))}
      initialActivity={JSON.parse(JSON.stringify(activityLogs))}
      session={session}
    />
  )
}
