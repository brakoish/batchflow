import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id } = await params

    const messages = await prisma.batchMessage.findMany({
      where: { batchId: id },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get batch messages error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params
    const body = await request.json()
    const { message } = body

    // Validate message
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const trimmedMessage = message.trim()
    if (trimmedMessage.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    if (trimmedMessage.length > 500) {
      return NextResponse.json(
        { error: 'Message cannot exceed 500 characters' },
        { status: 400 }
      )
    }

    // Create the message
    const batchMessage = await prisma.batchMessage.create({
      data: {
        batchId: id,
        workerId: session.id,
        message: trimmedMessage,
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ message: batchMessage })
  } catch (error) {
    console.error('Create batch message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
