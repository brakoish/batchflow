import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BellAlertIcon,
  ClockIcon,
  LinkIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import AppShell from '@/app/components/AppShell'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const sections = [
  {
    title: 'Team',
    items: [
      { href: '/workers', title: 'Employees & teams', description: 'People, roles, PINs, languages, pay rates, and saved crews', Icon: UserGroupIcon },
      { href: '/timesheet', title: 'Time & pay', description: 'Hours, corrections, exports, and pay estimates', Icon: ClockIcon },
      { href: '/reminders', title: 'Reminders', description: 'Recurring messages for employees on shift', Icon: BellAlertIcon },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/products', title: 'Products & brands', description: 'Organize brands and archive finished products', Icon: TagIcon },
    ],
  },
  {
    title: 'Company',
    items: [
      { href: '/announcements', title: 'Announcement', description: 'Set the alert shown to everyone on the floor', Icon: BellAlertIcon },
      { href: '/org/invite', title: 'Access', description: 'Copy the organization link and review membership', Icon: LinkIcon },
      { href: '/tools', title: 'Tools', description: 'Retail ID scanner and organization utilities', Icon: WrenchScrewdriverIcon },
    ],
  },
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
        <h1 className="text-xl font-bold text-foreground">Manage</h1>
        <p className="mt-1 text-sm text-muted-foreground">{organization.name} · {organization.timezone}</p>

        <div className="mt-5 space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {section.items.map(({ href, title, description, Icon }, index) => (
                  <Link key={href} href={href} className={`flex min-h-[68px] items-center gap-3 p-4 transition-colors hover:bg-muted/50 ${index ? 'border-t border-border' : ''}`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted">
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
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  )
}
