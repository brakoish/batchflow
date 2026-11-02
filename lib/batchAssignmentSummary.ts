import { prisma } from '@/lib/prisma'
import { assignmentSummary } from '@/lib/assignmentSummary'

export async function summarizeBatchAssignments<T extends { assignments?: { worker: { id: string; name: string } }[] }>(batches: T[], organizationId: string) {
  const teams = await prisma.workTeam.findMany({
    where: { organizationId },
    select: { name: true, members: { select: { workerId: true } } },
  })
  return batches.map(batch => ({ ...batch, assignmentLabel: assignmentSummary(batch.assignments, teams) }))
}
