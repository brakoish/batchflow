import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import WorkerManager from './WorkerManager'

export default async function WorkersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')
  if (session.user.role !== 'OWNER') redirect('/batches')

  const workers = await prisma.worker.findMany({
    select: { id: true, name: true, pin: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  return (
    <AppShell session={session}>
      <main className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-foreground mb-5">Workers</h1>
        <WorkerManager workers={JSON.parse(JSON.stringify(workers))} />
      </main>
    </AppShell>
  )
}