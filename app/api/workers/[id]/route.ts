import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { Role } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOwner()
    const { id } = await params
    const { name, role, pin, hourlyRate } = await request.json()

    const target = await prisma.worker.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    // Handle PIN update
    if (pin !== undefined) {
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN must be exactly 4 digits' },
          { status: 400 }
        )
      }
      // Check if PIN is already in use by another worker
      const existingWorker = await prisma.worker.findUnique({
        where: { pin },
      })
      if (existingWorker && existingWorker.id !== id) {
        return NextResponse.json(
          { error: 'PIN is already in use' },
          { status: 400 }
        )
      }

      const worker = await prisma.worker.update({
        where: { id },
        data: { pin },
        select: {
          id: true,
          name: true,
          pin: true,
          role: true,
          hourlyRate: true,
          createdAt: true,
        },
      })
      return NextResponse.json({ worker })
    }

    // Handle name/role update
    const updateData: { name?: string; role?: Role; hourlyRate?: number | null } = {}
    if (name) updateData.name = name
    if (role && ['WORKER', 'SUPERVISOR', 'OWNER'].includes(role)) updateData.role = role as Role
    if (hourlyRate !== undefined) {
      const parsedHourlyRate = hourlyRate === '' || hourlyRate === null ? null : Number(hourlyRate)
      if (parsedHourlyRate !== null && (!Number.isFinite(parsedHourlyRate) || parsedHourlyRate < 0 || parsedHourlyRate > 10000)) {
        return NextResponse.json({ error: 'Hourly rate must be between $0 and $10,000' }, { status: 400 })
      }
      updateData.hourlyRate = parsedHourlyRate === null ? null : Math.round(parsedHourlyRate * 100) / 100
    }

    const worker = await prisma.worker.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        pin: true,
        role: true,
        hourlyRate: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ worker })
  } catch (error) {
    console.error('Update worker error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOwner()
    const { id } = await params

    const deleted = await prisma.worker.deleteMany({
      where: { id, organizationId: session.user.organizationId },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete worker error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
