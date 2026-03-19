import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import AppShell from '@/app/components/AppShell'
import OrgInviteManager from './OrgInviteManager'

export default async function OrgInvitePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')
  if (session.user.role !== 'OWNER') redirect('/batches')

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      workers: {
        select: { id: true, name: true, role: true, createdAt: true },
        orderBy: { name: 'asc' },
      },
    },
  })

  if (!organization) {
    redirect('/org/new')
  }

  return (
    <AppShell session={session}>
      <main className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-foreground mb-5">
          Organization: {organization.name}
        </h1>
        <OrgInviteManager
          organization={JSON.parse(JSON.stringify(organization))}
        />
      </main>
    </AppShell>
  )
}
