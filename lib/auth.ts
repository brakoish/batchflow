import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

// Hybrid session that checks NextAuth first, then falls back to workerId cookie.
// Returns the NextAuth-style shape (session.user.X) so all API routes work unchanged.
export async function getSession() {
  // Try NextAuth session first (Google/email users)
  const nextAuthSession = await getServerSession(authOptions)
  if (nextAuthSession?.user?.id) {
    return nextAuthSession
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

  // Return in NextAuth session shape so API routes don't need changes
  return {
    user: {
      id: worker.id,
      name: worker.name,
      email: null,
      role: worker.role,
      organizationId: worker.organizationId,
      workerId: worker.id,
    },
  }
}

export async function requireSession() {
  const session = await getSession()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireOwner() {
  const session = await requireSession()
  if (session.user.role !== 'OWNER') {
    throw new Error('Forbidden: Owner access required')
  }
  return session
}

export async function requireSupervisorOrOwner() {
  const session = await requireSession()
  if (session.user.role !== 'SUPERVISOR' && session.user.role !== 'OWNER') {
    throw new Error('Forbidden: Supervisor or Owner access required')
  }
  return session
}

export async function requireOrganization() {
  const session = await requireSession()
  if (!session.user.organizationId) {
    throw new Error('No organization associated with user')
  }
  return session
}

export function isOwner(session: any): boolean {
  return session?.user?.role === 'OWNER'
}

export function isAdmin(session: any): boolean {
  return session?.user?.role === 'OWNER' || session?.user?.role === 'SUPERVISOR'
}

export function isWorker(session: any): boolean {
  return session?.user?.role === 'WORKER'
}

export async function getWorkerIdFromSession(session: any): Promise<string | null> {
  if (session?.user?.workerId) {
    return session.user.workerId
  }
  return null
}
