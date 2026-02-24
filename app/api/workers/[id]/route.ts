import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'
import { Role } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner()
    const { id } = await params
    const { name, role } = await request.json()

    const updateData: { name?: string; role?: Role } = {}
    if (name) updateData.name = name
    if (role && ['WORKER', 'OWNER'].includes(role)) updateData.role = role as Role

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
