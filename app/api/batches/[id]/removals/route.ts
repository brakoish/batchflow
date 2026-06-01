import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

async function getActivityWorkerId(session: Awaited<ReturnType<typeof requireSupervisorOrOwner>>) {
  if (session.user.workerId) return session.user.workerId

  const worker = await prisma.worker.findFirst({
    where: {
      organizationId: session.user.organizationId,
      role: { in: ['OWNER', 'SUPERVISOR'] },
    },
    select: { id: true },
  })

  return worker?.id || null
}

function getProducedBaseUnits(batch: {
  steps: { type: string; name: string; completedQuantity: number; unitRatio: number | null }[]
}) {
  const countSteps = batch.steps.filter(step => step.type === 'COUNT' && !step.name.startsWith('[Skipped] '))
  if (!countSteps.length) return 0

  return Math.max(
    ...countSteps.map(step => Math.floor(step.completedQuantity * (step.unitRatio || 1)))
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()

    const quantity = Number(body.quantity)
    const reason = String(body.reason || 'Distro').trim() || 'Distro'
    const note = body.note ? String(body.note).trim().slice(0, 500) : null

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a whole number greater than 0' }, { status: 400 })
    }

    const batch = await prisma.batch.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        steps: { select: { type: true, name: true, completedQuantity: true, unitRatio: true } },
        removals: { select: { quantity: true } },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const produced = getProducedBaseUnits(batch)
    const removed = batch.removals.reduce((sum, removal) => sum + removal.quantity, 0)
    const available = Math.max(0, produced - removed)

    if (quantity > available) {
      return NextResponse.json(
        { error: `Only ${available.toLocaleString()} ${batch.baseUnit} available to remove` },
        { status: 400 }
      )
    }

    const workerId = await getActivityWorkerId(session)
    if (!workerId) {
      return NextResponse.json({ error: 'No worker record available for activity' }, { status: 400 })
    }

    const removal = await prisma.batchRemoval.create({
      data: {
        batchId: id,
        workerId,
        quantity,
        reason: reason.slice(0, 60),
        note,
      },
      include: {
        worker: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ removal })
  } catch (error) {
    console.error('Create batch removal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
