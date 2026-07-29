import Link from 'next/link'
import { redirect } from 'next/navigation'
import { QrCodeIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { getSession } from '@/lib/session'
import { getOrganizationName } from '@/lib/organization'
import AppShell from '@/app/components/AppShell'

export default async function ToolsPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const organizationName = await getOrganizationName(session.organizationId)

  return (
    <AppShell session={session} organizationName={organizationName}>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
            Quick actions
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fast utilities built for the production floor.
          </p>
        </div>

        <Link
          href="/tools/retail-id"
          className="group flex min-h-[92px] items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <QrCodeIcon className="h-8 w-8" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold">Retail ID Scanner</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Scan a Metrc QR code and see the product name.
            </span>
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </main>
    </AppShell>
  )
}
