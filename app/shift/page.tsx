import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import ShiftScreen from './ShiftScreen'

export default async function ShiftPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')

  // Owners go straight to dashboard
  if (session.user.role === 'OWNER') redirect('/dashboard')

  return <ShiftScreen worker={{ id: session.user.workerId || session.user.id, name: session.user.name || '', role: session.user.role }} />
}