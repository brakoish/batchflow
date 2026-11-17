import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

// Read-only record of every weigh-in added, changed or removed on one step.
// The rows come from LogAudit, which the log routes write on each change.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id: batchId, stepId } = await params
    const step = await prisma.batchStep.findFirst({
      where: { id: stepId, batchId, batch: { organizationId: session.user.organizationId } },
      select: { id: true, batch: { select: { assignments: { select: { workerId: true } } } } },
    })
    if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

    if (
      session.user.role === 'WORKER' &&
      step.batch.assignments.length > 0 &&
      !step.batch.assignments.some(assignment => assignment.workerId === session.user.workerId)
    ) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const history = await prisma.logAudit.findMany({
      where: { batchStepId: stepId, action: { in: ['create', 'edit', 'delete'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        action: true,
        oldQuantity: true,
        newQuantity: true,
        oldNote: true,
        newNote: true,
        createdAt: true,
        worker: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ history })
  } catch (error) {
    console.error('Step history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
