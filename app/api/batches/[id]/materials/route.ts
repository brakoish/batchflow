import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'
import { parseMaterialQuantity, validateMaterialCloseout } from '@/lib/materialValidation'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id } = await params
    const body = await request.json()
    const action = String(body.action || '').toUpperCase()
    if (!['ADDITION', 'RECONCILE'].includes(action)) return NextResponse.json({ error: 'Invalid material action' }, { status: 400 })

    const result = await prisma.$transaction(async tx => {
      // Serialize material mutations for this batch so retries and simultaneous close/add actions cannot interleave.
      await tx.$queryRaw`SELECT "id" FROM "Batch" WHERE "id" = ${id} FOR UPDATE`
      const batch = await tx.batch.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true, materialName: true, materialReconciledAt: true, status: true, materialEvents: { select: { type: true, quantity: true } } },
      })
      if (!batch) return { error: 'Batch not found', status: 404 }
      if (!batch.materialName) return { error: 'Material tracking is not enabled for this batch', status: 400 }
      if (batch.materialReconciledAt) return { error: 'Material has already been reconciled', status: 409 }

      const actor = { workerId: session.user.workerId || null, actorName: session.user.name || session.user.role }
      if (action === 'ADDITION') {
        if (batch.status !== 'ACTIVE') return { error: 'Material can only be added to an active batch', status: 400 }
        const quantity = parseMaterialQuantity(body.quantity)
        if (quantity == null) return { error: 'Enter a material amount greater than 0', status: 400 }
        const event = await tx.batchMaterialEvent.create({
          data: { batchId: id, ...actor, type: 'ADDITION', quantity, note: body.note ? String(body.note).trim().slice(0, 500) : null },
          include: { worker: { select: { id: true, name: true } } },
        })
        return { event }
      }

      const totalIssued = batch.materialEvents
        .filter(event => event.type === 'ISSUE' || event.type === 'ADDITION')
        .reduce((sum, event) => sum + event.quantity, 0)
      const closeout = validateMaterialCloseout(body.returned, body.waste, totalIssued)
      if ('error' in closeout) return { error: closeout.error, status: 400 }
      const { returned, waste } = closeout

      const events = []
      if (returned > 0) events.push(await tx.batchMaterialEvent.create({ data: { batchId: id, ...actor, type: 'RETURN', quantity: returned } }))
      if (waste > 0) events.push(await tx.batchMaterialEvent.create({ data: { batchId: id, ...actor, type: 'WASTE', quantity: waste } }))
      events.push(await tx.batchMaterialEvent.create({ data: { batchId: id, ...actor, type: 'RECONCILE', quantity: 0, note: body.note ? String(body.note).trim().slice(0, 500) : null } }))
      const closed = await tx.batch.update({ where: { id }, data: { materialReconciledAt: new Date() }, select: { materialReconciledAt: true } })
      return { events, materialReconciledAt: closed.materialReconciledAt?.toISOString() }
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Batch material error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
