import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')
  if (session.user.role !== 'OWNER') redirect('/batches')

  const batches = await prisma.batch.findMany({
    where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
    include: {
      recipe: true,
      steps: { orderBy: { order: 'asc' } },
    },
    orderBy: { completedDate: 'desc' },
    take: 50,
  })

  return (
    <AppShell session={session}>

      <main className="max-w-3xl mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground mb-5">Batch History</h1>
        <HistoryClient initialBatches={JSON.parse(JSON.stringify(batches))} />
      </main>
    </AppShell>
  )
}
