import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import ReminderManager from './ReminderManager'

export default async function RemindersPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const [reminders, workers] = await Promise.all([
    prisma.reminder.findMany({
      where: { organizationId: session.organizationId },
      include: { assignments: { select: { workerId: true, enabled: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.worker.findMany({
      where: { organizationId: session.organizationId, role: { in: ['WORKER', 'SUPERVISOR'] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <AppShell session={session}>
      <main className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="text-xl font-bold text-foreground">Employee Reminders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recurring reminders run while assigned employees are clocked in.</p>
        <ReminderManager initialReminders={JSON.parse(JSON.stringify(reminders))} workers={workers} />
      </main>
    </AppShell>
  )
}
