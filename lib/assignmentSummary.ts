type Assignment = { worker: { id: string; name: string } }
export type AssignmentTeam = { name: string; members: { workerId: string }[] }

/** Only a unique, exact saved member set earns a team name. Never infer subsets. */
export function assignmentSummary(assignments: Assignment[] = [], teams: AssignmentTeam[] = []): string {
  const ids = new Set(assignments.map(a => a.worker.id))
  if (!ids.size) return 'Needs team'
  const matches = teams.filter(team => {
    const members = new Set(team.members.map(m => m.workerId))
    return members.size === ids.size && [...members].every(id => ids.has(id))
  })
  if (matches.length === 1) return matches[0].name
  if (ids.size > 3) return `${ids.size} people`
  return [...new Map(assignments.map(a => [a.worker.id, a.worker.name])).values()].join(', ')
}
