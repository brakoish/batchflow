import { getServerSession } from 'next-auth/next'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { authOptions } from './authOptions'

export type Session = {
  id: string
  name: string
  email?: string
  role: string
  organizationId: string
  workerId?: string
  type: 'nextauth' | 'pin'
}

export async function getSession() {
  // Try NextAuth session first (Google/email users)
  const nextAuthSession = await getServerSession(authOptions)
  
  if (nextAuthSession?.user) {
    return {
      id: nextAuthSession.user.id,
      name: nextAuthSession.user.name,
      email: nextAuthSession.user.email,
      role: nextAuthSession.user.role,
      organizationId: nextAuthSession.user.organizationId,
      workerId: nextAuthSession.user.workerId,
      type: 'nextauth' as const,
    }
  }
  
  // Fall back to workerId cookie (PIN users)
  const cookieStore = await cookies()
  const workerId = cookieStore.get('workerId')?.value
  
  if (!workerId) {
    return null
  }
  
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      name: true,
      role: true,
      organizationId: true,
    },
  })
  
  if (!worker) {
    return null
  }
  
  return {
    id: worker.id,
    name: worker.name,
    role: worker.role,
    organizationId: worker.organizationId,
    workerId: worker.id,
    type: 'pin' as const,
  }
}

export async function requireSession() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireOwner() {
  const session = await requireSession()
  if (session.role !== 'OWNER') {
    throw new Error('Forbidden: Owner access required')
  }
  return session
}
