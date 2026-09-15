import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import TeamManager from './TeamManager'

export default async function TeamsPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')
  const [teams, workers] = await Promise.all([
    prisma.workTeam.findMany({ where: { organizationId: session.organizationId }, include: { members: { include: { worker: { select: { id: true, name: true, role: true } } }, orderBy: { worker: { name: 'asc' } } } }, orderBy: { name: 'asc' } }),
    prisma.worker.findMany({ where: { organizationId: session.organizationId, role: { in: ['WORKER', 'SUPERVISOR'] } }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
  ])
  return <AppShell session={session}><main className="mx-auto max-w-2xl px-4 py-5 pb-24"><h1 className="text-xl font-bold text-foreground">Worker Teams</h1><p className="mt-1 text-sm text-muted-foreground">Save crews once, then assign a whole crew to a batch in one tap.</p><TeamManager initialTeams={JSON.parse(JSON.stringify(teams))} workers={workers} /></main></AppShell>
}
