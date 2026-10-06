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
