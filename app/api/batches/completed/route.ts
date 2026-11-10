import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { authErrorResponse } from '@/lib/apiErrors'

export async function GET() {
  try {
    const session = await requireOwner()

    const batches = await prisma.batch.findMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        organizationId: session.user.organizationId,
      },
      include: {
        recipe: true,
        product: true,
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: { completedDate: 'desc' },
      take: 50,
    })

    return NextResponse.json({ batches })
  } catch (error) {
    const authError = authErrorResponse(error)
    if (authError) return authError
    console.error('batches/completed failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
