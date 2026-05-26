export const SKIPPED_STEP_PREFIX = '[Skipped] '

export type ProductionLineLog = {
  id?: string
  quantity: number
  createdAt: string
  worker: { id: string; name: string }
}

export type ProductionLineStep = {
  id: string
  name: string
  order: number
  status: string
  type?: string
  completedQuantity: number
  targetQuantity: number | null
  unitLabel?: string
  progressLogs?: ProductionLineLog[]
}

export type StationState = {
  step: ProductionLineStep
  index: number
  label: 'done' | 'active' | 'ready' | 'waiting' | 'stale' | 'skipped'
  availableFromPrevious: number | null
  latestLog: ProductionLineLog | null
}

const RECENT_ACTIVITY_MS = 8 * 60 * 60 * 1000

export function displayProductionStepName(stepOrName: ProductionLineStep | string) {
  const name = typeof stepOrName === 'string' ? stepOrName : stepOrName.name
  return name.startsWith(SKIPPED_STEP_PREFIX) ? name.slice(SKIPPED_STEP_PREFIX.length) : name
}

export function isProductionStepSkipped(step: ProductionLineStep) {
  return step.name.startsWith(SKIPPED_STEP_PREFIX)
}

export function latestStepLog(step: ProductionLineStep): ProductionLineLog | null {
  if (!step.progressLogs?.length) return null
  return step.progressLogs.reduce((latest, log) => (
    new Date(log.createdAt).getTime() > new Date(latest.createdAt).getTime() ? log : latest
  ))
}

export function getStationStates(steps: ProductionLineStep[], now = Date.now()): StationState[] {
  return steps.map((step, index) => {
    const previous = index > 0 ? steps[index - 1] : null
    const latestLog = latestStepLog(step)
    const logAge = latestLog ? now - new Date(latestLog.createdAt).getTime() : null
    const hasRecentLog = logAge !== null && logAge <= RECENT_ACTIVITY_MS
    const isSkipped = isProductionStepSkipped(step)
    const isDone = step.status === 'COMPLETED' && !isSkipped
    const availableFromPrevious = previous ? Math.max(0, previous.completedQuantity - step.completedQuantity) : null

    let label: StationState['label'] = 'waiting'

    if (isSkipped) {
      label = 'skipped'
    } else if (isDone) {
      label = 'done'
    } else if (hasRecentLog || step.completedQuantity > 0) {
      label = 'active'
    } else if (!previous || availableFromPrevious > 0) {
      label = 'ready'
    } else if (latestLog) {
      label = 'stale'
    }

    return {
      step,
      index,
      label,
      availableFromPrevious,
      latestLog,
    }
  })
}

export function getActiveStations(steps: ProductionLineStep[], max = 3) {
  const states = getStationStates(steps)
  const active = states.filter((state) => state.label === 'active' || state.label === 'ready')
  if (active.length > 0) return active.slice(0, max)
  return states.filter((state) => state.label === 'waiting').slice(0, 1)
}

export function getLastBatchMovement(steps: ProductionLineStep[]) {
  return steps
    .map(latestStepLog)
    .filter((log): log is ProductionLineLog => Boolean(log))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
}

export function formatShortRelativeTime(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
