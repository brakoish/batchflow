import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import MyDayClient from './MyDayClient'

export default async function MyDayPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/')
  return <MyDayClient session={session} />
}
