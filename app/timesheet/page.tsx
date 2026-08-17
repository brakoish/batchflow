import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import TimesheetClient from './TimesheetClient'
import Link from 'next/link'

export default async function TimesheetPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const workers = await prisma.worker.findMany({
    where: { role: 'WORKER', organizationId: session.organizationId },
    select: { id: true, name: true, hourlyRate: true },
    orderBy: { name: 'asc' },
  })

  return (
    <AppShell session={session}>
      <main className="max-w-4xl mx-auto px-4 py-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Timesheets</h1>
          <Link href="/workers" className="bf-btn bf-btn-secondary">Set Wages</Link>
        </div>
        <TimesheetClient workers={JSON.parse(JSON.stringify(workers))} />
      </main>
    </AppShell>
  )
}
