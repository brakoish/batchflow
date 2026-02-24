import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, requireOwner } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id } = await params

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        recipe: true,
        steps: {
          orderBy: {
            order: 'asc',
          },
          include: {
            recipeStep: { select: { notes: true } },
            progressLogs: {
              include: {
                worker: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    })

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Get batch error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const { status } = await request.json()

    if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const batch = await prisma.batch.update({
      where: { id },
      data: {
        status,
        completedDate: status === 'COMPLETED' ? new Date() : null,
      },
      include: {
        recipe: true,
        steps: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Update batch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
