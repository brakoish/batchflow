export const TASK_STATUSES = ['ASSIGNED', 'SEEN', 'STARTED', 'BLOCKED', 'DONE'] as const
export function validDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function taskInput(body: any) {
  if (!body || typeof body !== 'object') throw new Error('Invalid task')
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
  if (!title || title.length > 160 || instructions.length > 2000) throw new Error('Use a title up to 160 characters and instructions up to 2000')
  if (!validDay(body.startDate) || !validDay(body.endDate) || body.endDate < body.startDate) throw new Error('Choose a valid date range')
  if (!Number.isInteger(body.position) || body.position < 0 || body.position > 9999) throw new Error('Order must be 0–9999')
  if (!Array.isArray(body.workerIds) || !body.workerIds.length || body.workerIds.length > 200 || body.workerIds.some((id: unknown) => typeof id !== 'string')) throw new Error('Choose employees')
  const workerIds = [...new Set<string>(body.workerIds)]
  const batchId = typeof body.batchId === 'string' && body.batchId ? body.batchId : null
  const stepId = typeof body.stepId === 'string' && body.stepId ? body.stepId : null
  if (stepId && !batchId) throw new Error('A step requires a batch')
  return { title, instructions, startDate: body.startDate as string, endDate: body.endDate as string, position: body.position as number, workerIds, batchId, stepId }
}
export function taskOverdue(task: {endDate: string}, status: string, today: string) { return status !== 'DONE' && task.endDate < today }
export function meaningfulTaskChange(previous: any, next: any) {
  return ['title','instructions','startDate','endDate','batchId','stepId'].some(key => previous[key] !== next[key])
}
