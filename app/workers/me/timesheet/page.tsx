import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrganizationName } from '@/lib/organization'
import MyTimesheetClient from './MyTimesheetClient'

export default async function MyTimesheetPage() {
  const session = await getSession()
  if (!session) redirect('/')
  // Owners have a richer timesheet at /timesheet — keep this one worker-focused
  if (session.role === 'OWNER') redirect('/timesheet')

  const organizationName = await getOrganizationName(session.organizationId)

  return <MyTimesheetClient session={session} organizationName={organizationName || 'Your Team'} />
}
