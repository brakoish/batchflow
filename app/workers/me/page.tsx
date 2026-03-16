import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import MyDayClient from './MyDayClient'

export default async function MyDayPage() {
  const session = await getSession()
  if (!session) redirect('/')
  return <MyDayClient session={session} />
}
