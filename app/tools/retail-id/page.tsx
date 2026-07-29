import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrganizationName } from '@/lib/organization'
import AppShell from '@/app/components/AppShell'
import RetailIdScanner from './RetailIdScanner'

export default async function RetailIdScannerPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const organizationName = await getOrganizationName(session.organizationId)

  return (
    <AppShell session={session} organizationName={organizationName}>
      <RetailIdScanner />
    </AppShell>
  )
}
