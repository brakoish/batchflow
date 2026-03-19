import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from './prisma'

export async function getSession() {
  const session = await getServerSession(authOptions)
  return session
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

// Helper to get worker ID from session (for backward compatibility)
export async function getWorkerIdFromSession(session: any): Promise<string | null> {
  if (session?.user?.workerId) {
    return session.user.workerId
  }
  return null
}
