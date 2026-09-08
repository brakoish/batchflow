import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { isReminderDue } from '@/lib/reminders'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await requireSession()
    const workerId = session.user.workerId
    if (!workerId) return NextResponse.json({ reminders: [] })

    const shift = await prisma.shift.findFirst({
      where: { workerId, status: 'ACTIVE' },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
    })
    if (!shift) return NextResponse.json({ reminders: [] })

    const assignments = await prisma.workerReminder.findMany({
      where: {
        workerId,
        enabled: true,
        reminder: { organizationId: session.user.organizationId },
      },
      include: { reminder: { select: { id: true, message: true, emoji: true, intervalMinutes: true } } },
    })

    const now = new Date()
    const due = []
    for (const assignment of assignments) {
      if (!isReminderDue({
        now,
        shiftStartedAt: shift.startedAt,
        assignmentUpdatedAt: assignment.updatedAt,
        lastSentAt: assignment.lastSentAt,
        intervalMinutes: assignment.reminder.intervalMinutes,
      })) continue

      const claimed = await prisma.workerReminder.updateMany({
        where: { id: assignment.id, enabled: true, lastSentAt: assignment.lastSentAt },
        data: { lastSentAt: now },
      })
      if (claimed.count) due.push(assignment.reminder)
    }

    return NextResponse.json(
      { reminders: due },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch {
    return NextResponse.json({ reminders: [] }, { status: 401 })
  }
}
