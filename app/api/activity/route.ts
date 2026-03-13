import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'

export async function GET() {
  try {
    await requireOwner()

    // Fetch both progress logs and audit logs
    const [progressLogs, auditLogs] = await Promise.all([
      prisma.progressLog.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          worker: {
            select: {
              id: true,
              name: true,
            },
          },
          batchStep: {
            include: {
              batch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.logAudit.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
          action: {
            in: ['edit', 'delete'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          worker: {
            select: {
              id: true,
              name: true,
            },
          },
          batchStep: {
            include: {
              batch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ])

    // Transform progress logs
    const logActivities = progressLogs.map((log) => ({
      id: log.id,
      type: 'log',
      createdAt: log.createdAt,
      worker: log.worker,
      batchStep: log.batchStep,
      quantity: log.quantity,
      note: log.note,
    }))

    // Transform audit logs
    const auditActivities = auditLogs.map((audit) => ({
      id: audit.id,
      type: audit.action, // 'edit' or 'delete'
      createdAt: audit.createdAt,
      worker: audit.worker,
      batchStep: audit.batchStep,
      oldQuantity: audit.oldQuantity,
      newQuantity: audit.newQuantity,
      oldNote: audit.oldNote,
      newNote: audit.newNote,
    }))

    // Merge and sort by createdAt
    const allActivities = [...logActivities, ...auditActivities]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)

    return NextResponse.json({ activities: allActivities })
  } catch (error) {
    console.error('Get activity error:', error)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
