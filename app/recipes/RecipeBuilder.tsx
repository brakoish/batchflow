'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, HashtagIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'

type UnitDef = { name: string; count: number }
type StepDef = { name: string; notes: string; type: 'CHECK' | 'COUNT'; unitName: string }

type EditRecipe = {
  id: string; name: string; description: string | null; baseUnit: string
  units: { name: string; ratio: number }[]
  steps: { name: string; notes: string | null; type: string; unit: { name: string } | null }[]
} | null

export default function RecipeBuilder({ editRecipe, onDone }: { editRecipe?: EditRecipe; onDone?: () => void }) {
  const isEdit = !!editRecipe
  const [name, setName] = useState(editRecipe?.name || '')
  const [description, setDescription] = useState(editRecipe?.description || '')
  const [baseUnit, setBaseUnit] = useState(editRecipe?.baseUnit || 'bags')
  const [units, setUnits] = useState<UnitDef[]>(
    editRecipe?.units.length
      ? editRecipe.units.map(u => ({ name: u.name, count: u.ratio }))
      : []
  )
  const [steps, setSteps] = useState<StepDef[]>(
    editRecipe?.steps.length
      ? editRecipe.steps.map(s => ({
          name: s.name,
          notes: s.notes || '',
          type: s.type as 'CHECK' | 'COUNT',
          unitName: s.unit?.name || '',
        }))
      : [{ name: '', notes: '', type: 'COUNT', unitName: '' }]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Unit helpers
  const addUnit = () => setUnits([...units, { name: '', count: 1 }])
  const removeUnit = (i: number) => setUnits(units.filter((_, idx) => idx !== i))
  const updateUnit = (i: number, field: string, value: any) => {
    const u = [...units]; (u[i] as any)[field] = value; setUnits(u)
  }

  // Step helpers
  const addStep = () => setSteps([...steps, { name: '', notes: '', type: 'COUNT', unitName: '' }])
  const removeStep = (i: number) => steps.length > 1 && setSteps(steps.filter((_, idx) => idx !== i))
  const updateStep = (i: number, field: string, value: string) => {
    const s = [...steps]; (s[i] as any)[field] = value; setSteps(s)
  }
  const moveStep = (i: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? i - 1 : i + 1
    if (t < 0 || t >= steps.length) return
    const s = [...steps]; [s[i], s[t]] = [s[t], s[i]]; setSteps(s)
  }


  // Simplified: units always reference the base unit directly
  const getBaseRatio = (unitName: string): number => {
    if (!unitName || unitName === baseUnit) return 1
    const u = units.find(x => x.name === unitName)
    return u?.count || 1
  }

  const allUnits = [
    { name: baseUnit, ratio: 1 },
    ...units.filter(u => u.name.trim()).map(u => ({ name: u.name, ratio: getBaseRatio(u.name) })),
  ]

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Give your recipe a name'); return }
    const validSteps = steps.filter((s) => s.name.trim())
    if (!validSteps.length) { setError('Add at least one step so workers know what to do'); return }

    setLoading(true); setError('')
    try {
      const url = isEdit ? `/api/recipes/${editRecipe!.id}` : '/api/recipes'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description: description || undefined, baseUnit,
          units: units.filter(u => u.name.trim()).map(u => ({
            name: u.name,
            ratio: getBaseRatio(u.name),
          })),
          steps: validSteps.map(s => ({
            name: s.name,
            notes: s.notes || undefined,
            type: s.type,
            unitName: s.unitName || undefined,
          })),
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      if (!isEdit) {
        setName(''); setDescription(''); setBaseUnit('bags')
        setUnits([]); setSteps([{ name: '', notes: '', type: 'COUNT', unitName: '' }])
      }
      router.refresh()
      onDone?.()
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {isEdit ? 'Edit Recipe' : 'New Recipe'}
      </h2>
      <div className="rounded-xl border border bg-card p-4 space-y-6">
        {/* What are you making? */}
        <div>
          <label className="text-sm text-foreground font-semibold block mb-1.5">What are you making?</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pre-Rolls, Gummies, Vape Cartridges" disabled={loading}
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm text-foreground font-semibold block mb-1.5">Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Any details about this recipe" disabled={loading}
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
        </div>

        {/* Base Unit */}
        <div>
          <label className="text-sm text-foreground font-semibold block mb-1.5">Base unit for counting</label>
          <p className="text-xs text-muted-foreground mb-2">The smallest unit you&apos;ll count</p>
          <input type="text" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}
            placeholder="e.g. bags, units, pieces" disabled={loading}
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
        </div>

        {/* Counting Units */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block">Counting Units</label>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">How do you count finished product?</p>
            </div>
            <button onClick={addUnit} disabled={loading}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-300 text-xs font-medium flex items-center gap-0.5">
              <PlusIcon className="w-3 h-3" />Add
            </button>
          </div>
          {units.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 italic">No additional units. Steps will use {baseUnit || 'base units'}.</p>
          ) : (
            <div className="space-y-3">
              {units.map((u, i) => (
                <div key={i} className="rounded-lg bg-muted/50 border border-input p-4">
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">Unit name</label>
                  <input type="text" value={u.name} onChange={(e) => updateUnit(i, 'name', e.target.value)}
                    placeholder="Cases" disabled={loading}
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all mb-3" />

                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">How many {baseUnit} per {u.name.trim() || 'unit'}?</label>
                  <input type="number" value={u.count} onChange={(e) => updateUnit(i, 'count', parseInt(e.target.value) || 1)}
                    min="1" disabled={loading} inputMode="numeric"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all mb-3" />

                  <button onClick={() => removeUnit(i)}
                    className="w-full min-h-[44px] py-2.5 rounded-lg border border-input text-sm text-muted-foreground hover:text-red-500 hover:border-red-500/30 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-2">
                    <XMarkIcon className="w-4 h-4" />Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Steps */}
        <div>
          <label className="text-sm text-foreground font-semibold block mb-1.5">Production steps</label>
          <p className="text-xs text-muted-foreground mb-3">Add the steps workers will follow</p>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="rounded-lg bg-muted/50 border border-input p-4">
                {/* Step number and reorder controls */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground font-bold">Step {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveStep(i, 'up')} disabled={i === 0}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:opacity-20 transition-colors">
                      <ChevronUpIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:opacity-20 transition-colors">
                      <ChevronDownIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => removeStep(i)} disabled={steps.length === 1}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground hover:text-red-500 dark:hover:text-red-400 disabled:opacity-20 transition-colors">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Step name */}
                <input type="text" value={step.name} onChange={(e) => updateStep(i, 'name', e.target.value)}
                  placeholder="Step name" disabled={loading}
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all mb-3" />

                {/* Type toggle - bigger pill buttons */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground font-medium block mb-2">Step type</label>
                  <div className="flex gap-2">
                    <button onClick={() => updateStep(i, 'type', 'CHECK')} disabled={loading}
                      className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        step.type === 'CHECK' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-2 border-blue-500/40' : 'bg-card border-2 border-input text-muted-foreground hover:border-border'
                      }`}>
                      <CheckCircleIcon className="w-5 h-5" />
                      <div className="text-left">
                        <div>Checkpoint</div>
                        <div className="text-[10px] opacity-70 font-normal">Just mark it done</div>
                      </div>
                    </button>
                    <button onClick={() => updateStep(i, 'type', 'COUNT')} disabled={loading}
                      className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        step.type === 'COUNT' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/40' : 'bg-card border-2 border-input text-muted-foreground hover:border-border'
                      }`}>
                      <HashtagIcon className="w-5 h-5" />
                      <div className="text-left">
                        <div>Count</div>
                        <div className="text-[10px] opacity-70 font-normal">Track how many</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Unit selector for COUNT steps - only show if additional units exist */}
                {step.type === 'COUNT' && units.filter(u => u.name.trim()).length > 0 && (
                  <div className="mb-3">
                    <label className="text-xs text-muted-foreground font-medium block mb-2">Count by</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => updateStep(i, 'unitName', '')}
                        disabled={loading}
                        className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all ${
                          !step.unitName ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/40' : 'bg-card border-2 border-input text-muted-foreground hover:border-border'
                        }`}
                      >
                        {baseUnit} (base)
                      </button>
                      {units.filter(u => u.name.trim()).map((u, idx) => (
                        <button
                          key={idx}
                          onClick={() => updateStep(i, 'unitName', u.name)}
                          disabled={loading}
                          className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all ${
                            step.unitName === u.name ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/40' : 'bg-card border-2 border-input text-muted-foreground hover:border-border'
                          }`}
                        >
                          {u.name} ({u.count}/{baseUnit})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <input type="text" value={step.notes} onChange={(e) => updateStep(i, 'notes', e.target.value)}
                  placeholder="Any instructions for this step?" disabled={loading}
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />

              </div>
            ))}
          </div>

          <button onClick={addStep} disabled={loading}
            className="w-full mt-3 min-h-[44px] py-3 rounded-lg border-2 border-dashed border-input text-sm text-foreground font-medium hover:bg-muted/50 hover:border-border transition-colors flex items-center justify-center gap-2">
            <PlusIcon className="w-4 h-4" />Add Step
          </button>
        </div>

        {/* Preview */}
        {steps.some(s => s.name.trim()) && (
          <div className="rounded-lg bg-muted/30 border border-input/50 p-4">
            <p className="text-sm text-foreground font-semibold mb-3">Preview (example: 500 {baseUnit} batch)</p>
            <div className="space-y-2">
              {steps.filter(s => s.name.trim()).map((s, i) => {
                if (s.type === 'CHECK') return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-blue-500/5 border border-blue-500/20">
                    <CheckCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">Checkpoint</span>
                  </div>
                )
                const ratio = s.unitName ? getBaseRatio(s.unitName) : 1
                const unit = s.unitName ? units.find(u => u.name === s.unitName) : null
                const target = Math.ceil(500 / ratio)
                const label = unit?.name || baseUnit
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                    <HashtagIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="ml-auto text-sm text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{target} {label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && <p className="text-red-500 dark:text-red-400 text-xs text-center">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-base transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isEdit ? 'Saving...' : 'Creating...'}
            </>
          ) : (
            isEdit ? 'Save Changes' : 'Create Recipe'
          )}
        </button>
      </div>
    </div>
  )
}
