export function parseMaterialQuantity(value: unknown, allowZero = false) {
  const quantity = Number(value)
  return Number.isFinite(quantity) && (allowZero ? quantity >= 0 : quantity > 0) ? quantity : null
}

export function validateMaterialCloseout(returnedValue: unknown, wasteValue: unknown, totalIssued: number) {
  const returned = parseMaterialQuantity(returnedValue, true)
  const waste = parseMaterialQuantity(wasteValue, true)
  if (returned == null || waste == null) return { error: 'Return and waste amounts must be 0 or greater' as const }
  if (returned + waste > totalIssued) return { error: `Returned and waste cannot exceed ${totalIssued.toLocaleString()} issued` as const }
  return { returned, waste }
}
