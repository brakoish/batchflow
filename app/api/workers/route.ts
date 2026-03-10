import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function GET() {
  try {
    await requireOwner()

    const workers = await prisma.worker.findMany({
      select: {
        id: true,
        name: true,
        pin: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ workers })
  } catch (error) {
    console.error('Get workers error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner()

    const { name, role, pin: customPin } = await request.json()

    if (!name || !role) {
      return NextResponse.json(
        { error: 'Name and role are required' },
        { status: 400 }
      )
    }

    if (!['WORKER', 'OWNER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Validate custom PIN if provided
    let pin: string
    if (customPin) {
      if (!/^\d{4}$/.test(customPin)) {
        return NextResponse.json(
          { error: 'PIN must be exactly 4 digits' },
          { status: 400 }
        )
      }
      // Check if PIN is already in use
      const existingWorker = await prisma.worker.findUnique({
        where: { pin: customPin },
      })
      if (existingWorker) {
        return NextResponse.json(
          { error: 'PIN is already in use' },
          { status: 400 }
        )
      }
      pin = customPin
    } else {
      // Generate unique PIN
      pin = generatePin()
      let existingWorker = await prisma.worker.findUnique({
        where: { pin },
      })
      while (existingWorker) {
        pin = generatePin()
        existingWorker = await prisma.worker.findUnique({
          where: { pin },
        })
      }
    }

    const worker = await prisma.worker.create({
      data: {
        name,
        role,
        pin,
      },
      select: {
        id: true,
        name: true,
        pin: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ worker })
  } catch (error) {
    console.error('Create worker error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}