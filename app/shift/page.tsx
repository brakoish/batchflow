import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import ShiftScreen from './ShiftScreen'

export default async function ShiftPage() {
  const session = await getSession()
  if (!session) redirect('/')

  // Owners go straight to dashboard
  if (session.role === 'OWNER') redirect('/dashboard')

  return <ShiftScreen worker={{ id: session.workerId || session.id, name: session.name || '', role: session.role }} />
}