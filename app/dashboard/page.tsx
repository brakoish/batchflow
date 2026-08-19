import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/')
  redirect('/batches')
}
