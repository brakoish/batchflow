import { cookies } from 'next/headers'
import { prisma } from './prisma'

export async function getSession() {
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
    },
  })

  return worker
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
