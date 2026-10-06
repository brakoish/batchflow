const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
}

export const MATERIAL_WEIGHT_UNITS = Object.keys(GRAMS_PER_UNIT)

export function convertMaterialQuantity(value: number, fromUnit: string, toUnit: string) {
  const fromGrams = GRAMS_PER_UNIT[fromUnit]
  const toGrams = GRAMS_PER_UNIT[toUnit]
  if (!Number.isFinite(value) || !fromGrams || !toGrams) return null
  return (value * fromGrams) / toGrams
}

export function formatWeightConversion(value: number, fromUnit: string, toUnit = 'lb') {
  const targetUnit = fromUnit === toUnit ? 'g' : toUnit
  const converted = convertMaterialQuantity(value, fromUnit, targetUnit)
  if (converted === null) return null
  return `${converted.toLocaleString(undefined, { maximumFractionDigits: targetUnit === 'lb' ? 3 : 2 })} ${targetUnit}`
}
