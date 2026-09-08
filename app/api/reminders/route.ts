import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth'

const includeReminder = {
  assignments: {
    select: { workerId: true, enabled: true },
  },
} as const

function reminderInput(body: any) {
  const message = String(body.message || '').trim().slice(0, 120)
  const emoji = String(body.emoji || '🔔').trim().slice(0, 16) || '🔔'
  const intervalMinutes = Number(body.intervalMinutes)
  if (!message) return { error: 'Reminder message is required' }
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 720) {
    return { error: 'Frequency must be between 5 minutes and 12 hours' }
  }
  return { message, emoji, intervalMinutes }
}

export async function GET() {
  try {
    const session = await requireOwner()
    const reminders = await prisma.reminder.findMany({
      where: { organizationId: session.user.organizationId },
      include: includeReminder,
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ reminders })
  } catch {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOwner()
    const input = reminderInput(await request.json())
    if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })

    const reminder = await prisma.reminder.create({
      data: { organizationId: session.user.organizationId, ...input },
      include: includeReminder,
    })
    return NextResponse.json({ reminder }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create reminder' }, { status: 500 })
  }
}
