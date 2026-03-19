import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { getOrganizationName } from '@/lib/organization'
import BatchListClient from './BatchListClient'

export default async function BatchesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')
  if (session.user.role === 'OWNER') redirect('/dashboard')

  const organizationName = await getOrganizationName(session.user.organizationId)

  const batches = await prisma.batch.findMany({
    where: {
      status: 'ACTIVE',
      organizationId: session.user.organizationId,
    },
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
      organizationName={organizationName || undefined}
    />
  )
}
