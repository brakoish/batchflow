import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { localDateKey } from '@/lib/timezone'
import { taskInput, TASK_STATUSES, meaningfulTaskChange } from '@/lib/directedTasks'
export const dynamic = 'force-dynamic'
const include = { assignments: { include: { worker: { select: { id: true, name: true } } } } } as const
export async function GET() {
  const session = await getSession()
  if (!session?.organizationId) return NextResponse.json({error:'Sign in required'}, {status:401})
  const manager = ['OWNER','SUPERVISOR'].includes(session.role)
  const workerId = session.workerId
  const organization = await prisma.organization.findUnique({where:{id:session.organizationId},select:{timezone:true}})
  const tasks = await prisma.directedTask.findMany({where:{organizationId:session.organizationId, archivedAt:null, ...(!manager ? {assignments:{some:{workerId:workerId || '__none__',removedAt:null}}} : {})},include,orderBy:[{position:'asc'},{createdAt:'asc'}]})
  const workers = manager ? await prisma.worker.findMany({where:{organizationId:session.organizationId},select:{id:true,name:true},orderBy:{name:'asc'}}) : []
  const batches = manager ? await prisma.batch.findMany({where:{organizationId:session.organizationId,status:'ACTIVE'},select:{id:true,name:true,steps:{select:{id:true,name:true},orderBy:{order:'asc'}}},orderBy:{name:'asc'}}) : []
  // Workers never receive coworkers' assignment status or notes.
  return NextResponse.json({tasks: tasks.map(task => ({...task, assignments:task.assignments.filter(a => manager || a.workerId === workerId)})),workers,batches,manager,workerId,today:localDateKey(new Date(),organization?.timezone || 'America/New_York')}, {headers:{'Cache-Control':'no-store'}})
}
export async function POST(request: NextRequest) { return mutate(request) }
export async function PATCH(request: NextRequest) { return mutate(request) }
async function mutate(request: NextRequest) {
  const session = await getSession()
  if (!session?.organizationId) return NextResponse.json({error:'Sign in required'},{status:401})
  const manager = ['OWNER','SUPERVISOR'].includes(session.role)
  try {
    const body = await request.json()
    if (request.method === 'POST' && body.action) throw new Error('Use PATCH for task actions')
    if (request.method === 'PATCH' && (typeof body.id !== 'string' || !body.id.trim() || !Number.isInteger(body.revision) || body.revision < 1)) throw new Error('Task ID and revision required')
    if (body.action === 'status') {
      if (!session.workerId || !TASK_STATUSES.includes(body.status)) throw new Error('Invalid status')
      const blockedNote = typeof body.blockedNote === 'string' ? body.blockedNote.trim() : ''
      if (blockedNote.length > 500 || (body.status === 'BLOCKED' && !blockedNote)) throw new Error('Explain what is blocking you (up to 500 characters)')
      await prisma.$transaction(async tx => {
        const task = await tx.directedTask.findFirst({where:{id:body.id,organizationId:session.organizationId,archivedAt:null}})
        if (!task) throw new Error('Task unavailable')
        if (body.revision !== task.revision) throw new Error('Task changed. Refresh before updating.')
        const result = await tx.directedTaskAssignment.updateMany({where:{taskId:task.id,workerId:session.workerId,removedAt:null},data:{status:body.status,blockedNote:body.status==='BLOCKED'?blockedNote:'',seenRevision:task.contentRevision}})
        if (result.count !== 1) throw new Error('Assignment unavailable')
      },{isolationLevel:'Serializable'})
      return NextResponse.json({ok:true})
    }
    if (!manager) return NextResponse.json({error:'Manager access required'},{status:403})
    if (body.action === 'archive') {
      const result = await prisma.directedTask.updateMany({where:{id:body.id,organizationId:session.organizationId,revision:body.revision,archivedAt:null},data:{archivedAt:new Date(),updatedBy:session.id}})
      if (!result.count) throw new Error('Task changed or unavailable. Refresh.')
      return NextResponse.json({ok:true})
    }
    const input = taskInput(body)
    const {workerIds,...data} = input
    const task = await prisma.$transaction(async tx => {
      const workers = await tx.worker.count({where:{id:{in:workerIds},organizationId:session.organizationId}})
      if (workers !== workerIds.length) throw new Error('Employee unavailable')
      if (data.batchId && !await tx.batch.findFirst({where:{id:data.batchId,organizationId:session.organizationId,status:'ACTIVE'}})) throw new Error('Batch unavailable')
      if (data.stepId && !await tx.batchStep.findFirst({where:{id:data.stepId,batchId:data.batchId!}})) throw new Error('Step unavailable')
      if (request.method === 'POST') return tx.directedTask.create({data:{...data,organizationId:session.organizationId,createdBy:session.id,updatedBy:session.id,assignments:{create:workerIds.map(workerId=>({workerId}))}},include})
      if (typeof body.id !== 'string') throw new Error('Task required')
      const previous = await tx.directedTask.findFirst({where:{id:body.id,organizationId:session.organizationId,archivedAt:null},include})
      if (!previous || body.revision !== previous.revision) throw new Error('Task changed or unavailable. Refresh.')
      const changed = meaningfulTaskChange(previous,data)
      await tx.directedTaskAssignment.updateMany({where:{taskId:previous.id,removedAt:null,workerId:{notIn:workerIds}},data:{removedAt:new Date()}})
      for (const workerId of workerIds) {
        const old = previous.assignments.find(a=>a.workerId===workerId)
        if (!old) await tx.directedTaskAssignment.create({data:{taskId:previous.id,workerId}})
        else if (old.removedAt) await tx.directedTaskAssignment.update({where:{id:old.id},data:{removedAt:null,status:'ASSIGNED',blockedNote:'',seenRevision:0}})
      }
      return tx.directedTask.update({where:{id:previous.id},data:{...data,revision:{increment:1},contentRevision:changed?{increment:1}:undefined,updatedBy:session.id},include})
    },{isolationLevel:'Serializable'})
    return NextResponse.json({task},{status:request.method==='POST'?201:200})
  } catch (error) {
    console.error('Directed task request failed', error instanceof Error ? error.name : 'Error')
    return NextResponse.json({error:error instanceof Error && !error.message.includes('prisma') ? error.message : 'Could not save. Refresh and retry.'},{status:400})
  }
}
