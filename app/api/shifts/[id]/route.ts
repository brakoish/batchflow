import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const { startedAt, endedAt } = await request.json()

    // Validate dates
    const start = new Date(startedAt)
    const end = endedAt ? new Date(endedAt) : null

    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 })
    }

    if (end && isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid end time' }, { status: 400 })
    }

    if (end && end <= start) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    // Update shift
    const shift = await prisma.shift.update({
      where: { id },
      data: {
        startedAt: start,
        endedAt: end,
        status: end ? 'COMPLETED' : 'ACTIVE',
      },
      include: { worker: { select: { id: true, name: true } } },
    })

    // Calculate hours
    const hours = shift.endedAt
      ? Math.round(((new Date(shift.endedAt).getTime() - new Date(shift.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100
      : Math.round(((Date.now() - new Date(shift.startedAt).getTime()) / 1000 / 60 / 60) * 100) / 100

    return NextResponse.json({ shift: { ...shift, hours } })
  } catch (error) {
    console.error('Update shift error:', error)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params

    await prisma.shift.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete shift error:', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}