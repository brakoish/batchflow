import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function TimesheetPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  redirect('/workers?view=hours')
}
