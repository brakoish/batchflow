import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import WorkerManager from './WorkerManager'
import Link from 'next/link'

export default async function WorkersPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const workers = await prisma.worker.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, name: true, pin: true, role: true, hourlyRate: true, preferredLanguage: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  return (
    <AppShell session={session}>
      <main className="max-w-2xl mx-auto px-4 py-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground">Workers</h1>
          <Link href="/reminders" className="bf-btn bf-btn-secondary">Reminders</Link>
        </div>
        <WorkerManager workers={JSON.parse(JSON.stringify(workers))} />
      </main>
    </AppShell>
  )
}
