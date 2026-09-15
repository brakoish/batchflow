import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSupervisorOrOwner } from '@/lib/auth'

const includeTeam = { members: { include: { worker: { select: { id: true, name: true, role: true } } }, orderBy: { worker: { name: 'asc' as const } } } } as const

export async function GET() {
  try {
    const session = await requireSupervisorOrOwner()
    const teams = await prisma.workTeam.findMany({ where: { organizationId: session.user.organizationId }, include: includeTeam, orderBy: { name: 'asc' } })
    return NextResponse.json({ teams })
  } catch { return NextResponse.json({ error: 'Supervisor access required' }, { status: 403 }) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSupervisorOrOwner()
    const body = await request.json()
    const name = String(body.name || '').trim().slice(0, 60)
    const workerIds: string[] = [...new Set<string>(Array.isArray(body.workerIds) ? body.workerIds.map((id: unknown) => String(id)) : [])]
    if (!name) return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    const count = await prisma.worker.count({ where: { id: { in: workerIds }, organizationId: session.user.organizationId, role: { in: ['WORKER', 'SUPERVISOR'] } } })
    if (count !== workerIds.length) return NextResponse.json({ error: 'One or more employees are invalid' }, { status: 400 })
    const team = await prisma.workTeam.create({ data: { name, organizationId: session.user.organizationId, members: { create: workerIds.map(workerId => ({ worker: { connect: { id: workerId } } })) } }, include: includeTeam })
    return NextResponse.json({ team }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'A team with that name already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Unable to create team' }, { status: 500 })
  }
}
