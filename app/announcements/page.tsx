import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import AnnouncementManager from './AnnouncementManager'

export default async function AnnouncementsPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER' && session.role !== 'SUPERVISOR') redirect('/batches')

  const [organization, announcement] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    }),
    prisma.announcement.findUnique({
      where: { organizationId: session.organizationId },
      select: { message: true, active: true, updatedAt: true },
    }),
  ])

  return (
    <AppShell session={session} organizationName={organization?.name}>
      <main className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-foreground">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">Share a time-sensitive update with the whole floor.</p>
        <AnnouncementManager initialAnnouncement={announcement ? JSON.parse(JSON.stringify(announcement)) : null} />
      </main>
    </AppShell>
  )
}
