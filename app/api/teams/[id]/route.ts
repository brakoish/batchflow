import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

const includeTeam = { members: { include: { worker: { select: { id: true, name: true, role: true } } }, orderBy: { worker: { name: 'asc' as const } } } } as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner(); const { id } = await params; const body = await request.json()
    const existing = await prisma.workTeam.findFirst({ where: { id, organizationId: session.user.organizationId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    const name = String(body.name || '').trim().slice(0, 60)
    const workerIds: string[] = [...new Set<string>(Array.isArray(body.workerIds) ? body.workerIds.map((workerId: unknown) => String(workerId)) : [])]
    if (!name) return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    const count = await prisma.worker.count({ where: { id: { in: workerIds }, organizationId: session.user.organizationId, role: { in: ['WORKER', 'SUPERVISOR'] } } })
    if (count !== workerIds.length) return NextResponse.json({ error: 'One or more employees are invalid' }, { status: 400 })
    const team = await prisma.$transaction(async tx => {
      await tx.workTeam.update({ where: { id }, data: { name } })
      await tx.workTeamMember.deleteMany({ where: { teamId: id } })
      if (workerIds.length) await tx.workTeamMember.createMany({ data: workerIds.map(workerId => ({ teamId: id, workerId })) })
      return tx.workTeam.findUniqueOrThrow({ where: { id }, include: includeTeam })
    })
    return NextResponse.json({ team })
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'A team with that name already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Unable to update team' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSupervisorOrOwner(); const { id } = await params
    const result = await prisma.workTeam.deleteMany({ where: { id, organizationId: session.user.organizationId } })
    if (!result.count) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Unable to delete team' }, { status: 500 }) }
}
