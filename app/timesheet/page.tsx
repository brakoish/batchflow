import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import TimesheetClient from './TimesheetClient'

export default async function TimesheetPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')
  if (session.user.role !== 'OWNER') redirect('/batches')

  const workers = await prisma.worker.findMany({
    where: { role: 'WORKER' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <AppShell session={session}>
      <main className="max-w-4xl mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground mb-5">Timesheets</h1>
        <TimesheetClient workers={JSON.parse(JSON.stringify(workers))} />
      </main>
    </AppShell>
  )
}