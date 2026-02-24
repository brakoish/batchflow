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

  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      recipe: true,
      steps: {
        orderBy: {
          order: 'asc',
        },
        include: {
          progressLogs: {
            include: {
              worker: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 5,
          },
        },
      },
    },
  })

  if (!batch) {
    redirect('/batches')
  }

  return (
    <BatchDetailClient
      batch={JSON.parse(JSON.stringify(batch))}
      session={session}
    />
  )
}
