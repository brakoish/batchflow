type InventoryStep = {
  name: string
  order: number
  type?: string
  completedQuantity: number
  unitRatio?: number | null
}

const SKIPPED_PREFIX = '[Skipped] '

export function getFinishedOutputStep<T extends InventoryStep>(steps: T[]) {
  return [...steps]
    .filter((step) => step.type === 'COUNT' && !step.name.startsWith(SKIPPED_PREFIX))
    .sort((a, b) => b.order - a.order)[0] || null
}

export function getProducedBaseUnits(steps: InventoryStep[]) {
  const output = getFinishedOutputStep(steps)
  if (!output) return 0
  return Math.max(0, Math.floor(output.completedQuantity * (output.unitRatio || 1)))
}

export function getRemovedQuantity(removals: { quantity: number }[] = []) {
  return removals.reduce((sum, removal) => sum + removal.quantity, 0)
}
