import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

const SKIPPED_PREFIX = '[Skipped] '

function withoutSkippedPrefix(name: string) {
  return name.startsWith(SKIPPED_PREFIX) ? name.slice(SKIPPED_PREFIX.length) : name
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const session = await requireSupervisorOrOwner()
    const { id, stepId } = await params
    const body = await request.json()

    const step = await prisma.batchStep.findFirst({
      where: {
        id: stepId,
        batchId: id,
        batch: { organizationId: session.user.organizationId },
      },
      include: {
        batch: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
              select: { id: true, name: true, order: true },
            },
          },
        },
        progressLogs: { select: { id: true } },
      },
    })

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const updateData: any = {}
    let activityAction = ''
    let activityOldQuantity: number | null = null
    let activityNewQuantity: number | null = null
    let activityOldNote: string | null = null
    let activityNewNote: string | null = null

    if (body.action === 'skip') {
      updateData.name = step.name.startsWith(SKIPPED_PREFIX) ? step.name : `${SKIPPED_PREFIX}${step.name}`
      updateData.status = 'COMPLETED'
      activityAction = 'step_skip'
      activityOldNote = withoutSkippedPrefix(step.name)
    } else if (body.action === 'unskip') {
      updateData.name = withoutSkippedPrefix(step.name)
      updateData.status = step.targetQuantity != null && step.completedQuantity >= step.targetQuantity
        ? 'COMPLETED'
        : 'IN_PROGRESS'
      activityAction = 'step_restore'
      activityOldNote = withoutSkippedPrefix(step.name)
    } else if (body.action === 'move-up' || body.action === 'move-down') {
      const direction = body.action === 'move-up' ? -1 : 1
      const orderedSteps = step.batch.steps
      const currentIndex = orderedSteps.findIndex((s) => s.id === step.id)
      const otherStep = orderedSteps[currentIndex + direction]

      if (!otherStep) {
        return NextResponse.json({ step }, { status: 200 })
      }

      await prisma.$transaction([
        prisma.batchStep.update({ where: { id: step.id }, data: { order: otherStep.order } }),
        prisma.batchStep.update({ where: { id: otherStep.id }, data: { order: step.order } }),
      ])

      const updatedStep = await prisma.batchStep.findUnique({
        where: { id: stepId },
        include: {
          recipeStep: { select: { notes: true, materials: true } },
          progressLogs: {
            include: { worker: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      const activityWorkerId = await getActivityWorkerId(session)
      if (activityWorkerId) {
        await prisma.logAudit.create({
          data: {
            batchStepId: step.id,
            workerId: activityWorkerId,
            action: 'step_reorder',
            oldQuantity: step.order,
            newQuantity: otherStep.order,
            oldNote: withoutSkippedPrefix(step.name),
          },
        })
      }

      return NextResponse.json({ step: updatedStep })
    } else if (body.name !== undefined || body.targetQuantity !== undefined || body.unitLabel !== undefined || body.type !== undefined) {
      activityAction = 'step_edit'
      activityOldQuantity = step.targetQuantity
      activityOldNote = `${withoutSkippedPrefix(step.name)} · ${step.type} · ${step.unitLabel}`

      if (body.name !== undefined) {
        const name = String(body.name || '').trim()
        if (!name) return NextResponse.json({ error: 'Step name is required' }, { status: 400 })
        updateData.name = step.name.startsWith(SKIPPED_PREFIX)
          ? `${SKIPPED_PREFIX}${name}`.slice(0, 80 + SKIPPED_PREFIX.length)
          : name.slice(0, 80)
      }

      if (body.type !== undefined) {
        if (body.type !== 'COUNT' && body.type !== 'CHECK') {
          return NextResponse.json({ error: 'Invalid step type' }, { status: 400 })
        }
        updateData.type = body.type
      }

      if (body.unitLabel !== undefined) {
        updateData.unitLabel = (String(body.unitLabel || 'units').trim() || 'units').slice(0, 30)
      }

      if (body.targetQuantity !== undefined) {
        const nextType = updateData.type || step.type
        const targetQuantity = nextType === 'CHECK'
          ? 1
          : body.targetQuantity == null || body.targetQuantity === ''
          ? null
          : Number(body.targetQuantity)

        if (targetQuantity !== null && (!Number.isInteger(targetQuantity) || targetQuantity <= 0)) {
          return NextResponse.json({ error: 'Target must be a whole number greater than 0' }, { status: 400 })
        }

        updateData.targetQuantity = targetQuantity
        if (targetQuantity !== null && step.completedQuantity >= targetQuantity) {
          updateData.status = 'COMPLETED'
        } else if (!step.name.startsWith(SKIPPED_PREFIX)) {
          updateData.status = 'IN_PROGRESS'
        }
      }

      activityNewQuantity = updateData.targetQuantity !== undefined ? updateData.targetQuantity : step.targetQuantity
      activityNewNote = `${withoutSkippedPrefix(updateData.name || step.name)} · ${updateData.type || step.type} · ${updateData.unitLabel || step.unitLabel}`
    } else {
      return NextResponse.json({ error: 'No step changes provided' }, { status: 400 })
    }

    const updatedStep = await prisma.batchStep.update({
      where: { id: stepId },
      data: updateData,
      include: {
        recipeStep: {
          select: {
            notes: true,
            materials: true,
          },
        },
        progressLogs: {
          include: {
            worker: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    const activityWorkerId = await getActivityWorkerId(session)
    if (activityWorkerId && activityAction) {
      await prisma.logAudit.create({
        data: {
          batchStepId: step.id,
          workerId: activityWorkerId,
          action: activityAction,
          oldQuantity: activityOldQuantity,
          newQuantity: activityNewQuantity,
          oldNote: activityOldNote,
          newNote: activityNewNote,
        },
      })
    }

    return NextResponse.json({ step: updatedStep })
  } catch (error) {
    console.error('Update batch step error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
