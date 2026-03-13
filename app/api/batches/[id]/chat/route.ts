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
      take: 100,
      orderBy: { createdAt: 'asc' },
      include: {
        worker: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params
    const { message } = await request.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 })
    }

    const batchMessage = await prisma.batchMessage.create({
      data: {
        batchId: id,
        workerId: session.id,
        message: message.trim(),
      },
      include: {
        worker: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ message: batchMessage })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
