export function parseStepQuantity(value: unknown, stepType: string) {
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (stepType !== 'ENTRY' && !Number.isInteger(quantity)) return null
  return quantity
}

export function getRecordedStepTotal(stepType: string, loggedQuantity: number) {
  return stepType === 'ENTRY' ? (loggedQuantity > 0 ? 1 : 0) : loggedQuantity
}
