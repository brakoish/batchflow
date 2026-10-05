import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import TeamHoursClient from './TeamHoursClient'

export default async function WorkersPage({ searchParams }: { searchParams?: { view?: string } }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const [workers, teams] = await Promise.all([prisma.worker.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, name: true, pin: true, role: true, hourlyRate: true, preferredLanguage: true, createdAt: true, workTeamMemberships: { select: { teamId: true } } },
    orderBy: { name: 'asc' },
  }), prisma.workTeam.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, name: true, members: { select: { workerId: true } } },
    orderBy: { name: 'asc' },
  })])

  return (
    <AppShell session={session}>
      <main className="mx-auto max-w-4xl px-4 py-5 pb-24">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-foreground">Team &amp; Hours</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage employees and check weekly hours in one place.</p>
        </div>
        <TeamHoursClient
          workers={JSON.parse(JSON.stringify(workers))}
          teams={teams}
          initialView={searchParams?.view === 'hours' ? 'hours' : 'people'}
        />
      </main>
    </AppShell>
  )
}
