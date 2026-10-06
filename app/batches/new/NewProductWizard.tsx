'use client'

import { useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import { baseStepsForCategory, categoryLabel, PROCESSING_CATEGORIES, type ProcessingCategory } from '@/lib/processingCategories'

export type NewBatchRecipe = {
  id: string
  name: string
  description: string | null
  baseUnit: string
  category?: string
  units: { id: string; name: string; ratio: number }[]
  products: { id: string; name: string; brand: string | null; unitsPerCase: number | null; materialWeightGrams: number | null; variations: { id: string; name: string }[] }[]
  steps: { id: string; name: string; order: number; notes: string | null; type: string; entryUnit?: string | null; unit?: { name: string } | null; materials?: { name: string; quantityPerUnit: number; unit: string }[] }[]
}

type StepDraft = { name: string; notes: string; type: 'CHECK' | 'COUNT' | 'ENTRY'; entryUnit: string; unitName: string; materials: { name: string; quantityPerUnit: number; unit: string }[] }

function suggestedBaseUnit(category: ProcessingCategory) {
  if (category === 'FLOWER') return 'Jars'
  if (category === 'VAPE') return 'Cartridges'
  if (category === 'PRE_ROLL') return 'Pre-rolls'
  if (category === 'PRE_ROLL_PACK') return 'Packs'
  return 'Units'
}

function categorySteps(category: ProcessingCategory): StepDraft[] {
  return baseStepsForCategory(category).map(step => ({
    name: step.name,
    notes: step.notes,
    type: step.type,
    entryUnit: step.entryUnit,
    unitName: step.unitName,
    materials: step.materials,
  }))
}

export default function NewProductWizard({ recipes, knownBrands, onCancel, onCreated }: {
  recipes: NewBatchRecipe[]
  knownBrands: string[]
  onCancel: () => void
  onCreated: (recipe: NewBatchRecipe, productId: string, variationId: string) => void
}) {
  const [category, setCategory] = useState<ProcessingCategory>('OTHER')
  const [brand, setBrand] = useState('')
  const [productName, setProductName] = useState('')
  const [variationName, setVariationName] = useState('')
  const [baseUnit, setBaseUnit] = useState('Units')
  const [materialWeightGrams, setMaterialWeightGrams] = useState('')
  const [source, setSource] = useState<'category' | 'copy' | 'blank'>('category')
  const [copyRecipeId, setCopyRecipeId] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([])
  const [units, setUnits] = useState<{ name: string; ratio: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const copyOptions = useMemo(() => recipes.flatMap(recipe => recipe.products.map(product => ({ recipe, product })))
    .sort((a, b) => `${a.product.brand || ''} ${a.product.name}`.localeCompare(`${b.product.brand || ''} ${b.product.name}`)), [recipes])

  const chooseCategory = (next: ProcessingCategory) => {
    setCategory(next)
    setBaseUnit(suggestedBaseUnit(next))
    setSource('category')
    setCopyRecipeId('')
    setUnits([])
    setSteps(categorySteps(next))
    haptic('light')
  }

  const chooseSource = (next: 'category' | 'copy' | 'blank') => {
    setSource(next)
    if (next === 'category') {
      setCopyRecipeId('')
      setUnits([])
      setSteps(categorySteps(category))
    }
    if (next === 'blank') {
      setCopyRecipeId('')
      setUnits([])
      setSteps([{ name: '', notes: '', type: 'COUNT', entryUnit: 'g', unitName: '', materials: [] }])
    }
  }

  const copyWorkflow = (recipeId: string) => {
    setCopyRecipeId(recipeId)
    const recipe = recipes.find(item => item.id === recipeId)
    if (!recipe) return
    setCategory((recipe.category as ProcessingCategory) || 'OTHER')
    setBaseUnit(recipe.baseUnit)
    setUnits(recipe.units.map(unit => ({ name: unit.name, ratio: unit.ratio })))
    setSteps(recipe.steps.map(step => ({ name: step.name, notes: step.notes || '', type: step.type as StepDraft['type'], entryUnit: step.entryUnit || 'g', unitName: step.unit?.name || '', materials: step.materials || [] })))
  }

  const updateStep = (index: number, patch: Partial<StepDraft>) => setSteps(current => current.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step))
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= steps.length) return
    setSteps(current => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async () => {
    const cleanSteps = steps.filter(step => step.name.trim())
    if (!brand.trim() || !productName.trim()) { setError('Add the brand and product name'); return }
    if (!variationName.trim()) { setError('Add the first strain, flavor, or variation'); return }
    if (!baseUnit.trim()) { setError('Enter what this product counts'); return }
    if (!cleanSteps.length) { setError('Add at least one production step'); return }
    const duplicate = cleanSteps.find((step, index) => cleanSteps.findIndex(candidate => candidate.name.trim().toLowerCase() === step.name.trim().toLowerCase()) !== index)
    if (duplicate) { setError(`Step names must be unique: ${duplicate.name.trim()}`); return }

    setSaving(true); setError('')
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${brand.trim()} · ${productName.trim()}`,
          baseUnit: baseUnit.trim(),
          category,
          units,
          products: [{ name: productName.trim(), brand: brand.trim(), materialWeightGrams: materialWeightGrams || null, variations: [variationName.trim()] }],
          steps: cleanSteps.map(step => ({ name: step.name.trim(), notes: step.notes.trim() || undefined, type: step.type, entryUnit: step.type === 'ENTRY' ? step.entryUnit || 'g' : undefined, unitName: step.type === 'COUNT' ? step.unitName || undefined : undefined, materials: step.materials })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setError(data.error || 'Unable to create product'); return }
      const recipe = data.recipe as NewBatchRecipe
      const product = recipe.products[0]
      const variation = product?.variations[0]
      if (!product || !variation) { setError('Product was created without its first variation'); return }
      haptic('medium')
      onCreated(recipe, product.id, variation.id)
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-emerald-500/25 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold text-foreground">Set up a new product</h2><p className="mt-1 text-xs text-muted-foreground">Save its normal steps, then start the first batch.</p></div>
        <button type="button" onClick={onCancel} disabled={saving} className="bf-btn bf-btn-ghost bf-btn-sm">Cancel</button>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Category</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{PROCESSING_CATEGORIES.map(option => <button key={option.value} type="button" onClick={() => chooseCategory(option.value)} className={`bf-select-btn justify-center ${category === option.value ? 'bf-select-btn-active' : ''}`}>{option.label}</button>)}</div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Product</label>
        <input value={brand} onChange={event => setBrand(event.target.value.slice(0, 100))} list="new-product-brand-options" placeholder="Brand" className="min-h-[48px] w-full rounded-xl border border-input bg-muted px-3 text-base text-foreground" />
        <datalist id="new-product-brand-options">{knownBrands.map(value => <option key={value} value={value} />)}</datalist>
        <input value={productName} onChange={event => setProductName(event.target.value.slice(0, 120))} placeholder="Product — e.g. 3.5g Jar" className="min-h-[48px] w-full rounded-xl border border-input bg-muted px-3 text-base text-foreground" />
        <div className="grid grid-cols-2 gap-2">
          <input value={variationName} onChange={event => setVariationName(event.target.value.slice(0, 120))} placeholder="First strain / flavor" className="min-h-[48px] min-w-0 rounded-xl border border-input bg-muted px-3 text-base text-foreground" />
          <input value={baseUnit} onChange={event => setBaseUnit(event.target.value.slice(0, 40))} placeholder="Count as — Jars" className="min-h-[48px] min-w-0 rounded-xl border border-input bg-muted px-3 text-base text-foreground" />
        </div>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" value={materialWeightGrams} onChange={event => setMaterialWeightGrams(event.target.value)} placeholder="Material per finished unit in grams (optional)" className="min-h-[48px] w-full rounded-xl border border-input bg-muted px-3 text-base text-foreground" />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">3. Start the steps from</label>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => chooseSource('category')} className={`bf-select-btn justify-center px-2 text-xs ${source === 'category' ? 'bf-select-btn-active' : ''}`}>{categoryLabel(category)} base</button>
          <button type="button" onClick={() => chooseSource('copy')} className={`bf-select-btn justify-center px-2 text-xs ${source === 'copy' ? 'bf-select-btn-active' : ''}`}>Copy product</button>
          <button type="button" onClick={() => chooseSource('blank')} className={`bf-select-btn justify-center px-2 text-xs ${source === 'blank' ? 'bf-select-btn-active' : ''}`}>Start blank</button>
        </div>
        {source === 'copy' && <select value={copyRecipeId} onChange={event => copyWorkflow(event.target.value)} className="mt-2 min-h-[48px] w-full rounded-xl border border-input bg-muted px-3 text-base text-foreground"><option value="">Choose a product to copy…</option>{copyOptions.map(({ recipe, product }) => <option key={product.id} value={recipe.id}>{product.brand ? `${product.brand} · ` : ''}{product.name}</option>)}</select>}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">4. Normal production steps</label><span className="text-xs text-muted-foreground">{steps.filter(step => step.name.trim()).length} steps</span></div>
        <div className="space-y-2">
          {steps.map((step, index) => <div key={index} className="rounded-xl border border-border bg-muted/25 p-3">
            <div className="flex gap-2">
              <span className="flex h-10 w-8 shrink-0 items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</span>
              <input value={step.name} onChange={event => updateStep(index, { name: event.target.value })} placeholder="Step name" className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base text-foreground" />
              <button type="button" onClick={() => setSteps(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove step ${index + 1}`} className="bf-icon-btn bf-icon-btn-danger"><XMarkIcon className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 pl-10">
              <select value={step.type} onChange={event => updateStep(index, { type: event.target.value as StepDraft['type'] })} className="min-h-[40px] rounded-lg border border-input bg-card px-2 text-sm text-foreground"><option value="COUNT">Count</option><option value="CHECK">Done check</option><option value="ENTRY">Measurement</option></select>
              <button type="button" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="Move step up" className="bf-icon-btn"><ChevronUpIcon className="h-4 w-4" /></button>
              <button type="button" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} aria-label="Move step down" className="bf-icon-btn"><ChevronDownIcon className="h-4 w-4" /></button>
            </div>
            {step.type === 'ENTRY' && <input value={step.entryUnit} onChange={event => updateStep(index, { entryUnit: event.target.value.slice(0, 30) })} placeholder="Measurement unit — g" style={{ width: 'calc(100% - 2.5rem)' }} className="ml-10 mt-2 min-h-[40px] rounded-lg border border-input bg-card px-3 text-sm text-foreground" />}
            <input value={step.notes} onChange={event => updateStep(index, { notes: event.target.value })} placeholder="Instructions (optional)" style={{ width: 'calc(100% - 2.5rem)' }} className="ml-10 mt-2 min-h-[40px] rounded-lg border border-input bg-card px-3 text-sm text-foreground" />
          </div>)}
        </div>
        <button type="button" onClick={() => setSteps(current => [...current, { name: '', notes: '', type: 'COUNT', entryUnit: 'g', unitName: '', materials: [] }])} className="bf-btn bf-btn-secondary mt-3 w-full border-dashed"><PlusIcon className="h-4 w-4" /> Add step</button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button type="button" onClick={save} disabled={saving} className="bf-btn bf-btn-success min-h-[50px] w-full">{saving ? 'Saving product…' : 'Save product & continue to batch'}</button>
    </section>
  )
}
