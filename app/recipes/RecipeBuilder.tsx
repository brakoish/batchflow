'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, HashtagIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'

type UnitDef = { name: string; count: number; perUnit: string }
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
      ? editRecipe.units.map(u => ({ name: u.name, count: u.ratio, perUnit: '' }))
      : []
  )
  const [steps, setSteps] = useState<StepDef[]>(
    editRecipe?.steps.length
      ? editRecipe.steps.map(s => ({ name: s.name, notes: s.notes || '', type: s.type as 'CHECK' | 'COUNT', unitName: s.unit?.name || '' }))
      : [{ name: '', notes: '', type: 'COUNT', unitName: '' }]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Unit helpers
  const addUnit = () => setUnits([...units, { name: '', count: 1, perUnit: '' }])
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

  // Compute base ratio for each unit by chaining
  const getBaseRatio = (unitName: string, visited: Set<string> = new Set()): number => {
    if (!unitName || unitName === baseUnit) return 1
    if (visited.has(unitName)) return 1 // prevent cycles
    visited.add(unitName)
    const u = units.find(x => x.name === unitName)
    if (!u) return 1
    return u.count * getBaseRatio(u.perUnit, visited)
  }

  const allUnits = [
    { name: baseUnit, ratio: 1 },
    ...units.filter(u => u.name.trim()).map(u => ({ name: u.name, ratio: getBaseRatio(u.name) })),
  ]

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Recipe name required'); return }
    const validSteps = steps.filter((s) => s.name.trim())
    if (!validSteps.length) { setError('Add at least one step'); return }

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
          steps: validSteps,
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
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        {isEdit ? 'Edit Recipe' : 'New Recipe'}
      </h2>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
        {/* Name + Description */}
        <div className="space-y-2.5">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name" disabled={loading}
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)" disabled={loading}
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
        </div>

        {/* Base Unit */}
        <div>
          <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-1.5">Base Unit</label>
          <input type="text" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}
            placeholder="e.g. bags, units, pieces" disabled={loading}
            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
        </div>

        {/* Additional Units */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Additional Units</label>
            <button onClick={addUnit} disabled={loading}
              className="text-emerald-400 hover:text-emerald-300 text-xs font-medium flex items-center gap-0.5">
              <PlusIcon className="w-3 h-3" />Add
            </button>
          </div>
          {units.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No additional units. Steps will use {baseUnit || 'base units'}.</p>
          ) : (
            <div className="space-y-2">
              {units.map((u, i) => {
                // Available "per" units: base + any units defined before this one
                const perOptions = [baseUnit, ...units.slice(0, i).filter(x => x.name.trim()).map(x => x.name)]
                const resolved = getBaseRatio(u.name)
                return (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <input type="text" value={u.name} onChange={(e) => updateUnit(i, 'name', e.target.value)}
                      placeholder="Unit name (e.g. cases)" disabled={loading}
                      className="flex-1 min-w-[100px] px-2.5 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                    <span className="text-[10px] text-zinc-500">=</span>
                    <input type="number" value={u.count} onChange={(e) => updateUnit(i, 'count', parseInt(e.target.value) || 1)}
                      min="1" disabled={loading}
                      className="w-14 px-2.5 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                    <select value={u.perUnit} onChange={(e) => updateUnit(i, 'perUnit', e.target.value)} disabled={loading}
                      className="px-2 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all">
                      {perOptions.map((opt) => (
                        <option key={opt} value={opt === baseUnit ? '' : opt}>{opt}</option>
                      ))}
                    </select>
                    {resolved > 1 && u.perUnit && (
                      <span className="text-[10px] text-zinc-600">= {resolved} {baseUnit}</span>
                    )}
                    <button onClick={() => removeUnit(i)} className="p-1 text-zinc-500 hover:text-red-400 transition-colors">
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Steps */}
        <div>
          <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-2">Steps</label>
          <div className="space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-zinc-600 font-bold tabular-nums w-4">{i + 1}.</span>
                  <input type="text" value={step.name} onChange={(e) => updateStep(i, 'name', e.target.value)}
                    placeholder="Step name" disabled={loading}
                    className="flex-1 px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => moveStep(i, 'up')} disabled={i === 0} className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-20"><ChevronUpIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1} className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-20"><ChevronDownIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeStep(i)} disabled={steps.length === 1} className="p-1 text-zinc-500 hover:text-red-400 disabled:opacity-20"><XMarkIcon className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {/* Type toggle */}
                  <button onClick={() => updateStep(i, 'type', 'CHECK')} disabled={loading}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                      step.type === 'CHECK' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-400'
                    }`}>
                    <CheckCircleIcon className="w-3 h-3" />Check
                  </button>
                  <button onClick={() => updateStep(i, 'type', 'COUNT')} disabled={loading}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                      step.type === 'COUNT' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-400'
                    }`}>
                    <HashtagIcon className="w-3 h-3" />Count
                  </button>

                  {/* Unit selector for COUNT steps */}
                  {step.type === 'COUNT' && (
                    <select
                      value={step.unitName}
                      onChange={(e) => updateStep(i, 'unitName', e.target.value)}
                      disabled={loading}
                      className="px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    >
                      <option value="">{baseUnit} (base)</option>
                      {units.filter(u => u.name.trim()).map((u, idx) => (
                        <option key={idx} value={u.name}>{u.name} ({getBaseRatio(u.name)} {baseUnit}/ea)</option>
                      ))}
                    </select>
                  )}
                </div>

                <input type="text" value={step.notes} onChange={(e) => updateStep(i, 'notes', e.target.value)}
                  placeholder="Notes (optional)" disabled={loading}
                  className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
              </div>
            ))}
          </div>

          <button onClick={addStep} disabled={loading}
            className="w-full mt-2.5 py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center gap-1">
            <PlusIcon className="w-3.5 h-3.5" />Add Step
          </button>
        </div>

        {/* Preview */}
        {steps.some(s => s.name.trim() && s.type === 'COUNT') && (
          <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/50 p-3">
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">Preview (for 500 {baseUnit} batch)</p>
            {steps.filter(s => s.name.trim()).map((s, i) => {
              if (s.type === 'CHECK') return (
                <p key={i} className="text-xs text-zinc-400"><span className="text-zinc-600 tabular-nums">{i+1}.</span> {s.name} — <span className="text-blue-400">check</span></p>
              )
              const ratio = s.unitName ? getBaseRatio(s.unitName) : 1
              const unit = s.unitName ? units.find(u => u.name === s.unitName) : null
              const target = Math.ceil(500 / ratio)
              const label = unit?.name || baseUnit
              return (
                <p key={i} className="text-xs text-zinc-400"><span className="text-zinc-600 tabular-nums">{i+1}.</span> {s.name} — <span className="text-emerald-400 tabular-nums">{target} {label}</span></p>
              )
            })}
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40">
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Recipe'}
        </button>
      </div>
    </div>
  )
}
