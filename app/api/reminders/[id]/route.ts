import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOwner()
    const { id } = await params
    const reminder = await prisma.reminder.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!reminder) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })

    const body = await request.json()
    if (!body.workerId) {
      const message = String(body.message || '').trim().slice(0, 120)
      const emoji = String(body.emoji || '🔔').trim().slice(0, 16) || '🔔'
      const intervalMinutes = Number(body.intervalMinutes)
      if (!message) return NextResponse.json({ error: 'Reminder message is required' }, { status: 400 })
      if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 720) {
        return NextResponse.json({ error: 'Frequency must be between 5 minutes and 12 hours' }, { status: 400 })
      }
      const updated = await prisma.reminder.update({
        where: { id },
        data: { message, emoji, intervalMinutes },
        include: { assignments: { select: { workerId: true, enabled: true } } },
      })
      return NextResponse.json({ reminder: updated })
    }

    const workerId = String(body.workerId || '')
    const enabled = Boolean(body.enabled)
    const worker = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!worker) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const assignment = await prisma.workerReminder.upsert({
      where: { reminderId_workerId: { reminderId: id, workerId } },
      create: { reminderId: id, workerId, enabled, lastSentAt: null },
      update: { enabled, ...(enabled ? { lastSentAt: null } : {}) },
      select: { workerId: true, enabled: true },
    })
    return NextResponse.json({ assignment })
  } catch {
    return NextResponse.json({ error: 'Unable to update reminder' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOwner()
    const { id } = await params
    const result = await prisma.reminder.deleteMany({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!result.count) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete reminder' }, { status: 500 })
  }
}
