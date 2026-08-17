import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BellAlertIcon,
  ClockIcon,
  LinkIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import AppShell from '@/app/components/AppShell'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const ownerItems = [
  { href: '/workers', title: 'Team', description: 'Workers, supervisors, PINs, roles, and wages', Icon: UserGroupIcon },
  { href: '/timesheet', title: 'Timesheets & pay', description: 'Hours, corrections, exports, and pay estimates', Icon: ClockIcon },
  { href: '/announcements', title: 'Announcement', description: 'Set the alert shown to everyone on the floor', Icon: BellAlertIcon },
  { href: '/org/invite', title: 'Invite & access', description: 'Copy the organization link and review membership', Icon: LinkIcon },
  { href: '/tools', title: 'Tools', description: 'Retail ID scanner and organization utilities', Icon: WrenchScrewdriverIcon },
]

export default async function OrganizationPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, timezone: true },
  })
  if (!organization) redirect('/org/new')

  return (
    <AppShell session={session} organizationName={organization.name}>
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <h1 className="text-xl font-bold text-foreground">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">{organization.name} · {organization.timezone}</p>

        <div className="mt-5 space-y-2">
          {ownerItems.map(({ href, title, description, Icon }) => (
            <Link key={href} href={href} className="flex min-h-[72px] items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
              </span>
              <span className="ml-auto text-muted-foreground" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  )
}
