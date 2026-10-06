export const PROCESSING_CATEGORIES = [
  { value: 'FLOWER', label: 'Flower' },
  { value: 'PRE_ROLL', label: 'Pre-roll' },
  { value: 'PRE_ROLL_PACK', label: 'Pre-roll pack' },
  { value: 'VAPE', label: 'Vape' },
  { value: 'EDIBLE', label: 'Edible' },
  { value: 'CONCENTRATE', label: 'Concentrate' },
  { value: 'OTHER', label: 'Other' },
] as const

export type ProcessingCategory = typeof PROCESSING_CATEGORIES[number]['value']

export function normalizeProcessingCategory(value: unknown): ProcessingCategory {
  const candidate = String(value || '').trim().toUpperCase()
  return PROCESSING_CATEGORIES.some(category => category.value === candidate)
    ? candidate as ProcessingCategory
    : 'OTHER'
}

export function categoryLabel(value: string) {
  return PROCESSING_CATEGORIES.find(category => category.value === value)?.label || 'Other'
}

export function baseStepsForCategory(category: ProcessingCategory) {
  if (category === 'FLOWER') return [
    { name: 'Record input weight', notes: 'Weigh all starting flower before production begins.', type: 'ENTRY' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Fill finished product', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Apply labels and COA', notes: 'Set the exact placement for this brand and product.', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Quality check', notes: '', type: 'CHECK' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Record waste weight', notes: 'Enter waste in grams. Enter 0 when there was no waste.', type: 'ENTRY' as const, entryUnit: 'g', unitName: '', materials: [] },
  ]
  if (category === 'PRE_ROLL' || category === 'PRE_ROLL_PACK') return [
    { name: 'Record input weight', notes: '', type: 'ENTRY' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Fill and close pre-rolls', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: category === 'PRE_ROLL_PACK' ? 'Pack and label' : 'Tube and label', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Quality check', notes: '', type: 'CHECK' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Record waste weight', notes: 'Enter waste in grams. Enter 0 when there was no waste.', type: 'ENTRY' as const, entryUnit: 'g', unitName: '', materials: [] },
  ]
  if (category === 'VAPE') return [
    { name: 'Record input weight', notes: '', type: 'ENTRY' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Fill hardware', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Assemble and label', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Quality check', notes: '', type: 'CHECK' as const, entryUnit: 'g', unitName: '', materials: [] },
  ]
  if (category === 'EDIBLE') return [
    { name: 'Prepare batch', notes: '', type: 'CHECK' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Produce units', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Package and label', notes: '', type: 'COUNT' as const, entryUnit: 'g', unitName: '', materials: [] },
    { name: 'Quality check', notes: '', type: 'CHECK' as const, entryUnit: 'g', unitName: '', materials: [] },
  ]
  return []
}
