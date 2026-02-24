import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import BatchListClient from './BatchListClient'

export default async function BatchesPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role === 'OWNER') redirect('/dashboard')

  const batches = await prisma.batch.findMany({
    where: { status: 'ACTIVE' },
    include: {
      recipe: true,
      steps: { orderBy: { order: 'asc' } },
    },
    orderBy: { startDate: 'desc' },
  })

  return (
    <BatchListClient
      initialBatches={JSON.parse(JSON.stringify(batches))}
      session={session}
    />
  )
}
