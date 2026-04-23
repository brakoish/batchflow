'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, HashtagIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'

// Relations between units. Three fields:
//  - name:   the unit being defined (Pre-rolls, Case, Tray, etc.)
//  - count:  the number in the sentence
//  - basedOn: which already-known unit the count is in terms of.
//            '' means the sellable (base) unit; otherwise an earlier relation’s name.
//  - direction:
//      'bigger'  → sentence reads "1 {name} = {count} {basedOn}"    (Case = 20 Tins)
//      'smaller' → sentence reads "{count} {name} = 1 {basedOn}"   (14 Pre-rolls = 1 Tin)
// The stored ratio (base units per 1 of {name}) is computed on submit:
//   bigger  : ratio = count × basedOnRatio
//   smaller : ratio = basedOnRatio / count   (fractional — requires Float in DB)
type UnitDef = { name: string; count: number; basedOn?: string; direction?: 'bigger' | 'smaller' }
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
  const [baseUnit, setBaseUnit] = useState(editRecipe?.baseUnit || '')
  // When editing an existing recipe we only have the flat base-unit ratio,
  // not the chain. Default basedOn='' (base unit) and surface the raw count;
  // users can switch basedOn on the fly to re-express it without needing a
  // data migration.
  // When editing an existing recipe we only have the flat base-unit ratio,
  // not the chain. Re-express:
  //   ratio >= 1  → 'bigger', count = ratio (e.g. Case ratio 20 → '1 Case = 20 base')
  //   ratio <  1  → 'smaller', count = round(1/ratio)
  // basedOn stays '' (base) — users can nest further after loading.
  const [units, setUnits] = useState<UnitDef[]>(
    editRecipe?.units.length
      ? editRecipe.units.map(u => {
          const r = u.ratio
          if (r < 1 && r > 0) {
            return { name: u.name, count: Math.round(1 / r), basedOn: '', direction: 'smaller' as const }
          }
          return { name: u.name, count: Math.max(1, Math.round(r)), basedOn: '', direction: 'bigger' as const }
        })
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
  const addUnit = () => { haptic('light'); setUnits([...units, { name: '', count: 1, basedOn: '', direction: 'bigger' }]) }
  const removeUnit = (i: number) => {
    const removed = units[i]
    // If any later unit was based on this one, fall them back to the base unit
    // so we don't leave dangling references.
    const next = units
      .filter((_, idx) => idx !== i)
      .map(u => (u.basedOn === removed?.name ? { ...u, basedOn: '' } : u))
    setUnits(next)
  }
  const updateUnit = (i: number, field: string, value: any) => {
    const u = [...units]; (u[i] as any)[field] = value
    // If a user renamed a unit that later units depend on, update their basedOn
    // to match so the chain stays intact.
    if (field === 'name') {
      const oldName = units[i].name
      for (let j = i + 1; j < u.length; j++) {
        if (u[j].basedOn === oldName) u[j].basedOn = value
      }
    }
    setUnits(u)
  }

  // Options for a unit's basedOn dropdown:
  //  - the base unit, plus any packaging unit defined *before* this one.
  // Only earlier units are offered so we can't form circular references.
  const basedOnOptions = (i: number): { value: string; label: string }[] => {
    const opts = [{ value: '', label: baseUnit || 'base unit' }]
    for (let j = 0; j < i; j++) {
      const u = units[j]
      if (u.name.trim()) opts.push({ value: u.name, label: u.name })
    }
    return opts
  }

  // Step helpers
  const addStep = () => { haptic('light'); setSteps([...steps, { name: '', notes: '', type: 'COUNT', unitName: '' }]) }
  const removeStep = (i: number) => steps.length > 1 && setSteps(steps.filter((_, idx) => idx !== i))
  const updateStep = (i: number, field: string, value: string) => {
    const s = [...steps]; (s[i] as any)[field] = value; setSteps(s)
  }
  const moveStep = (i: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? i - 1 : i + 1
    if (t < 0 || t >= steps.length) return
    haptic('light')
    const s = [...steps]; [s[i], s[t]] = [s[t], s[i]]; setSteps(s)
  }

  // How many base units are in one of `unitName`. Walks the basedOn chain,
  // applying each relation’s direction:
  //   bigger  → multiply by count (1 Case = 20 Tins → ratio ×= 20)
  //   smaller → divide by count    (14 Pre-rolls = 1 Tin → 1 Pre-roll = 1/14 Tin, ratio ÷= 14)
  // Guard with a seen set so a malformed cycle can't loop forever.
  const getBaseRatio = (unitName: string): number => {
    if (!unitName || unitName === baseUnit) return 1
    const seen = new Set<string>()
    let currentName: string | undefined = unitName
    let ratio = 1
    while (currentName && !seen.has(currentName)) {
      seen.add(currentName)
      const u = units.find(x => x.name === currentName)
      if (!u) break
      const c = u.count || 1
      if (u.direction === 'smaller') {
        ratio /= c
      } else {
        ratio *= c
      }
      if (!u.basedOn) break
      currentName = u.basedOn
    }
    return ratio
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Give your recipe a name — like "1g Pre-Rolls" or "Flower Jars"'); return }
    if (!baseUnit.trim()) { setError('What are you counting? Enter a base unit like "bags", "jars", or "pre-rolls"'); return }
    const validSteps = steps.filter((s) => s.name.trim())
    if (!validSteps.length) { setError('Add at least one step so your team knows what to do'); return }

    haptic('medium')
    setLoading(true); setError('')
    try {
      const url = isEdit ? `/api/recipes/${editRecipe!.id}` : '/api/recipes'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description: description || undefined, baseUnit,
          // Submit each unit's ratio in base-units-per-1-of-this-unit.
          // getBaseRatio already honors direction ('bigger' multiplies, 'smaller' divides).
          units: units.filter(u => u.name.trim()).map(u => ({
            name: u.name,
            ratio: getBaseRatio(u.name),
          })),
          steps: validSteps.map(s => ({
            name: s.name, notes: s.notes || undefined, type: s.type, unitName: s.unitName || undefined,
          })),
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      if (!isEdit) {
        setName(''); setDescription(''); setBaseUnit('')
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
      <div className="space-y-8">

        {/* ── Product Name ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-base text-foreground font-semibold block mb-1">What are you making?</label>
          <p className="text-sm text-muted-foreground mb-3">
            This is the product name your team will see when they start a batch.
          </p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 1g Pre-Rolls, 14g Flower Bags, Gummy Bears" disabled={loading}
            className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-muted/50 border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all" />

          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional) — e.g., Standard 14g ground flower bags" disabled={loading}
            className="w-full mt-3 px-4 py-3 min-h-[48px] rounded-xl bg-muted/50 border-2 border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all" />
        </div>

        {/* ── Sellable Unit ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-base text-foreground font-semibold block mb-1">What do you sell?</label>
          <p className="text-sm text-muted-foreground mb-3">
            The finished product — what you set a batch target in. For pre-rolls packed in tins, that’s “Tins.” For loose flower, it might be “Bags” or “Jars.”
          </p>
          <input type="text" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}
            placeholder="e.g., Tins, Bags, Jars, Cartridges" disabled={loading}
            className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-muted/50 border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all" />
          {baseUnit && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              ✓ Batch targets will be set in {baseUnit}
            </p>
          )}
        </div>

        {/* ── Relations ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-base text-foreground font-semibold block mb-1">Relations</label>
          <p className="text-sm text-muted-foreground mb-1">
            Optional. Add any unit a step needs to count in — inputs flowing into your {baseUnit || 'product'}, or shipping containers going out. Just fill in the sentence.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            e.g., <span className="font-medium">14 Pre-rolls = 1 {baseUnit || 'Tin'}</span> · <span className="font-medium">1 Case = 20 {baseUnit || 'Tins'}</span>
          </p>

          {units.length === 0 ? (
            <button onClick={addUnit} disabled={loading}
              className="w-full min-h-[48px] py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground font-medium hover:text-foreground hover:border-foreground/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <PlusIcon className="w-4 h-4" />Add a relation
            </button>
          ) : (
            <div className="space-y-3">
              {units.map((u, i) => {
                // Which known units can be the 'right side' of this sentence?
                // The sellable unit plus every earlier relation. Excludes this
                // relation’s own name so it can’t reference itself.
                const rhsOptions = basedOnOptions(i)
                return (
                  <div key={i} className="rounded-xl bg-muted/30 border border-border p-4">
                    {/* Sentence template: [count] [new unit] = 1 [known unit]
                        Reads naturally for both directions:
                          14 Pre-rolls = 1 Tin          (input)
                          1 Case       = 20 Tins  ← inverted? No — we still write it
                            as: 1 Case = 20 Tins but to keep the data model identical
                            (the "new" unit is always the left side being defined),
                            users who want to define a bigger unit write it the same
                            way by expressing the count in the smaller direction:
                          'A Case holds 20 Tins' → 'Cases' has count=20 basedOn=Tins.
                        To surface that intuitively, show two layouts based on which
                        direction is more natural: default is 'COUNT NEW-UNIT = 1 KNOWN'
                        (fits Pre-rolls into Tins), and we provide a subtle toggle for
                        the 'BIGGER-UNIT = COUNT KNOWN' direction (fits Cases over Tins).
                    */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.direction === 'bigger' ? (
                        <>
                          <span className="text-sm text-muted-foreground shrink-0">1</span>
                          <input
                            type="text"
                            value={u.name}
                            onChange={(e) => updateUnit(i, 'name', e.target.value)}
                            placeholder="Case"
                            disabled={loading}
                            className="flex-1 min-w-[6rem] px-3 py-2.5 min-h-[44px] rounded-lg bg-card border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all"
                          />
                          <span className="text-sm text-muted-foreground shrink-0">=</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={u.count}
                            onChange={(e) => updateUnit(i, 'count', parseInt(e.target.value) || 1)}
                            min="1"
                            disabled={loading}
                            className="w-20 shrink-0 px-3 py-2.5 min-h-[44px] rounded-lg bg-card border-2 border-border text-foreground text-base font-semibold tabular-nums text-center focus:outline-none focus:border-emerald-500 transition-all"
                          />
                          <select
                            value={u.basedOn || ''}
                            onChange={(e) => updateUnit(i, 'basedOn', e.target.value)}
                            disabled={loading || rhsOptions.length <= 1}
                            className="shrink-0 px-3 py-2.5 min-h-[44px] rounded-lg bg-card border-2 border-border text-foreground text-base focus:outline-none focus:border-emerald-500 transition-all"
                          >
                            {rhsOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={u.count}
                            onChange={(e) => updateUnit(i, 'count', parseInt(e.target.value) || 1)}
                            min="1"
                            disabled={loading}
                            className="w-20 shrink-0 px-3 py-2.5 min-h-[44px] rounded-lg bg-card border-2 border-border text-foreground text-base font-semibold tabular-nums text-center focus:outline-none focus:border-emerald-500 transition-all"
                          />
                          <input
                            type="text"
                            value={u.name}
                            onChange={(e) => updateUnit(i, 'name', e.target.value)}
                            placeholder="Pre-rolls"
                            disabled={loading}
                            className="flex-1 min-w-[6rem] px-3 py-2.5 min-h-[44px] rounded-lg bg-card border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all"
                          />
                          <span className="text-sm text-muted-foreground shrink-0">= 1</span>
                          <select
                            value={u.basedOn || ''}
                            onChange={(e) => updateUnit(i, 'basedOn', e.target.value)}
                            disabled={loading || rhsOptions.length <= 1}
                            className="shrink-0 px-3 py-2.5 min-h-[44px] rounded-lg bg-card border-2 border-border text-foreground text-base focus:outline-none focus:border-emerald-500 transition-all"
                          >
                            {rhsOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>

                    {/* Flip direction + confirmation line + remove */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => updateUnit(i, 'direction', u.direction === 'bigger' ? 'smaller' : 'bigger')}
                        disabled={loading}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors min-h-[36px] px-2"
                      >
                        ⇄ Flip — {u.direction === 'bigger' ? `it’s smaller than a ${u.basedOn || baseUnit || 'base unit'}` : `it’s bigger than a ${u.basedOn || baseUnit || 'base unit'}`}
                      </button>
                      <button
                        onClick={() => removeUnit(i)}
                        aria-label="Remove"
                        className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-muted transition-colors flex items-center justify-center"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Confirmation: walk the chain down to the sellable unit */}
                    {u.name.trim() && u.count > 0 && baseUnit && (() => {
                      const baseRatio = getBaseRatio(u.name)
                      if (!baseRatio || baseRatio === 1) return null
                      const rhsLabel = u.basedOn || baseUnit
                      const showExpansion = u.basedOn && u.basedOn !== baseUnit && baseRatio !== u.count
                      return (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                          {u.direction === 'bigger' ? (
                            <>✓ 1 {u.name} = {u.count.toLocaleString()} {rhsLabel}{showExpansion && <span className="text-muted-foreground"> = {baseRatio.toLocaleString()} {baseUnit}</span>}</>
                          ) : (
                            <>✓ {u.count.toLocaleString()} {u.name} = 1 {rhsLabel}{showExpansion && <span className="text-muted-foreground"> · 1 {baseUnit} = {baseRatio.toLocaleString()} {u.name}</span>}</>
                          )}
                        </p>
                      )
                    })()}
                  </div>
                )
              })}
              <button onClick={addUnit} disabled={loading}
                className="w-full min-h-[44px] py-2.5 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground font-medium hover:text-foreground hover:border-foreground/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <PlusIcon className="w-4 h-4" />Add another relation
              </button>
            </div>
          )}
        </div>

        {/* ── Steps ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-base text-foreground font-semibold block mb-1">Production steps</label>
          <p className="text-sm text-muted-foreground mb-1">
            List every step your team follows, in order. Think of it as the checklist someone would follow to make this product from start to finish.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            Example for pre-rolls: Mix flower → Fill cones → Twist & pack → Label → Case up → QC check
          </p>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="rounded-xl bg-muted/30 border border-border p-4">
                {/* Header with step number and controls */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground font-bold tabular-nums">Step {i + 1}</span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => moveStep(i, 'up')} disabled={i === 0}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground hover:bg-card disabled:opacity-20 transition-colors">
                      <ChevronUpIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground hover:bg-card disabled:opacity-20 transition-colors">
                      <ChevronDownIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => removeStep(i)} disabled={steps.length === 1}
                      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 dark:hover:text-red-400 disabled:opacity-20 transition-colors">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Step name */}
                <div className="mb-3">
                  <input type="text" value={step.name} onChange={(e) => updateStep(i, 'name', e.target.value)}
                    placeholder={i === 0 ? 'e.g., Weigh & Prep Materials' : i === 1 ? 'e.g., Fill Bags' : 'Step name'}
                    disabled={loading}
                    className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all" />
                </div>

                {/* Type toggle */}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground font-medium block mb-2">What do workers do at this step?</label>
                  <div className="flex gap-2">
                    <button onClick={() => { haptic('light'); updateStep(i, 'type', 'CHECK') }} disabled={loading}
                      className={`flex-1 min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
                        step.type === 'CHECK' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-2 border-blue-500' : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                      }`}>
                      <CheckCircleIcon className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div>Checkpoint</div>
                        <div className="text-[11px] opacity-70 font-normal">Mark done — no counting</div>
                      </div>
                    </button>
                    <button onClick={() => { haptic('light'); updateStep(i, 'type', 'COUNT') }} disabled={loading}
                      className={`flex-1 min-h-[56px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
                        step.type === 'COUNT' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500' : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                      }`}>
                      <HashtagIcon className="w-6 h-6 shrink-0" />
                      <div className="text-left">
                        <div>Count</div>
                        <div className="text-[11px] opacity-70 font-normal">Workers log quantities</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Unit selector for COUNT steps */}
                {step.type === 'COUNT' && units.filter(u => u.name.trim()).length > 0 && (
                  <div className="mb-3">
                    <label className="text-xs text-muted-foreground font-medium block mb-1.5">What does the worker count on this step?</label>
                    <p className="text-[11px] text-muted-foreground/70 mb-2">
                      Pick the thing they physically handle. The batch total still tracks in {baseUnit || 'your sellable unit'}.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { haptic('light'); updateStep(i, 'unitName', '') }}
                        disabled={loading}
                        className={`px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                          !step.unitName ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500' : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                        }`}
                      >
                        {baseUnit || 'base unit'}
                      </button>
                      {units.filter(u => u.name.trim()).map((u, idx) => (
                        <button
                          key={idx}
                          onClick={() => { haptic('light'); updateStep(i, 'unitName', u.name) }}
                          disabled={loading}
                          className={`px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                            step.unitName === u.name ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500' : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                          }`}
                        >
                          {u.name} ({(() => {
                            // Display nicely whether smaller ('14 per base') or bigger ('20 base/ea')
                            const r = getBaseRatio(u.name)
                            if (r >= 1) return `${Number.isInteger(r) ? r.toLocaleString() : r.toFixed(2)} ${baseUnit}/ea`
                            if (r > 0) return `${Math.round(1 / r).toLocaleString()} per ${baseUnit}`
                            return ''
                          })()})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <input type="text" value={step.notes} onChange={(e) => updateStep(i, 'notes', e.target.value)}
                  placeholder="Instructions or notes — e.g., Use 3.5g per jar, keep lids tight" disabled={loading}
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all" />
              </div>
            ))}
          </div>

          <button onClick={addStep} disabled={loading}
            className="w-full mt-3 min-h-[48px] py-3 rounded-xl border-2 border-dashed border-border text-sm text-foreground font-medium hover:bg-muted/50 hover:border-foreground/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <PlusIcon className="w-4 h-4" />Add another step
          </button>
        </div>

        {/* ── Preview ── */}
        {steps.some(s => s.name.trim()) && (
          <div className="rounded-xl border border-border bg-card p-5">
            <label className="text-base text-foreground font-semibold block mb-1">Preview</label>
            <p className="text-sm text-muted-foreground mb-4">
              Here&apos;s what your team will see for a 500 {baseUnit || 'unit'} batch:
            </p>
            <div className="space-y-2">
              {steps.filter(s => s.name.trim()).map((s, i) => {
                if (s.type === 'CHECK') return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <CheckCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-sm text-foreground font-medium">{s.name}</span>
                    <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 px-2 py-1 rounded-lg">Checkpoint</span>
                  </div>
                )
                const ratio = s.unitName ? getBaseRatio(s.unitName) : 1
                const unit = s.unitName ? units.find(u => u.name === s.unitName) : null
                const target = Math.ceil(500 / ratio)
                const label = unit?.name || baseUnit || 'units'
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <HashtagIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm text-foreground font-medium">{s.name}</span>
                    <span className="ml-auto text-sm text-emerald-600 dark:text-emerald-400 font-bold tabular-nums bg-emerald-500/10 px-2 py-1 rounded-lg">{target} {label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full min-h-[52px] py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-base transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isEdit ? 'Saving...' : 'Creating...'}
            </>
          ) : (
            <>{isEdit ? 'Save Changes' : 'Create Recipe'} &rarr;</>
          )}
        </button>
      </div>
    </div>
  )
}
