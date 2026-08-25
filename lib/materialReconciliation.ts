export type MaterialEvent = { type: 'ISSUE' | 'ADDITION' | 'RETURN' | 'WASTE' | 'RECONCILE'; quantity: number }

export function getMaterialReconciliation(
  events: MaterialEvent[],
  producedBaseUnits: number,
  materialRatio: number | null | undefined,
) {
  const sum = (type: 'ISSUE' | 'ADDITION' | 'RETURN' | 'WASTE') => events
    .filter(event => event.type === type)
    .reduce((total, event) => total + event.quantity, 0)
  const issued = sum('ISSUE')
  const additions = sum('ADDITION')
  const returned = sum('RETURN')
  const waste = sum('WASTE')
  const expectedUsed = materialRatio && materialRatio > 0 ? producedBaseUnits / materialRatio : null
  const unexplained = expectedUsed == null ? null : issued + additions - returned - waste - expectedUsed
  const variancePct = unexplained == null || issued + additions <= 0
    ? null
    : (unexplained / (issued + additions)) * 100

  return { issued, additions, returned, waste, expectedUsed, unexplained, variancePct }
}

export function formatMaterialQuantity(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
