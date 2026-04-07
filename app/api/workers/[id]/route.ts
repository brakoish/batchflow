import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'
import { Role } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const { name, role, pin } = await request.json()

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
          createdAt: true,
        },
      })
      return NextResponse.json({ worker })
    }

    // Handle name/role update
    const updateData: { name?: string; role?: Role } = {}
    if (name) updateData.name = name
    if (role && ['WORKER', 'SUPERVISOR', 'OWNER'].includes(role)) updateData.role = role as Role

    const worker = await prisma.worker.update({
      where: { id },
      data: updateData,
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
    await requireOwner()
    const { id } = await params

    await prisma.worker.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete worker error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
