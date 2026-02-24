import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

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
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50 mb-5">Batch History</h1>
        <HistoryClient initialBatches={JSON.parse(JSON.stringify(batches))} />
      </main>
    </AppShell>
  )
}
