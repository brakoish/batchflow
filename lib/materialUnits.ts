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
