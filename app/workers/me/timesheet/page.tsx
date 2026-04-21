import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import MyTimesheetClient from './MyTimesheetClient'

export default async function MyTimesheetPage() {
  const session = await getSession()
  if (!session) redirect('/')
  // Owners have a richer timesheet at /timesheet — keep this one worker-focused
  if (session.role === 'OWNER') redirect('/timesheet')
  return <MyTimesheetClient session={session} />
}
