export function parseStepQuantity(value: unknown, stepType: string) {
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity < 0 || (stepType !== 'ENTRY' && quantity === 0)) return null
  if (stepType !== 'ENTRY' && !Number.isInteger(quantity)) return null
  return quantity
}

export function getRecordedStepTotal(stepType: string, loggedQuantity: number, hasEntryLog = loggedQuantity > 0) {
  return stepType === 'ENTRY' ? (hasEntryLog ? 1 : 0) : loggedQuantity
}

export function isRecordedStepComplete(step: {
  type: string
  completedQuantity: number
  status: string
}) {
  if (step.type === 'ENTRY') return step.completedQuantity > 0
  if (step.type === 'CHECK') return step.status === 'COMPLETED'
  return false
}

const WEIGHT_ENTRY_UNITS = new Set(['g', 'kg', 'oz', 'lb'])

// Weight entries (g, kg, oz, lb) collect weigh-ins as material is opened, so
// staff weigh only what they are working with and add more as they go. The
// step's recorded value is the sum of its weigh-ins. Other measurements
// (for example a moisture reading) stay a single recorded value.
export function isWeighInStep(step: { type: string; unitLabel?: string | null }) {
  return step.type === 'ENTRY' && WEIGHT_ENTRY_UNITS.has(String(step.unitLabel || '').trim().toLowerCase())
}

export function getEntryTotal(logs: { quantity: number }[] = []) {
  return logs.reduce((sum, log) => sum + (Number.isFinite(log.quantity) ? log.quantity : 0), 0)
}

// The value shown and reported for an entry step: the running total for a
// weigh-in step, or the single latest value for any other entry.
export function getEntryValue(step: { type: string; unitLabel?: string | null; progressLogs?: { quantity: number }[] }) {
  const logs = step.progressLogs || []
  if (logs.length === 0) return null
  return isWeighInStep(step) ? getEntryTotal(logs) : logs[0].quantity
}
