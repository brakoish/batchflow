'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'

type Recipe = {
  id: string; name: string; description: string | null; baseUnit: string
  steps: { id: string; name: string; order: number; notes: string | null }[]
}

type Worker = { id: string; name: string }

export default function BatchCreator({ recipes, workers }: { recipes: Recipe[]; workers: Worker[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [batchType, setBatchType] = useState<'fixed' | 'open'>('fixed')
  const [targetQuantity, setTargetQuantity] = useState('')
  const [dueDatePreset, setDueDatePreset] = useState<'none' | 'week' | 'nextweek' | 'custom'>('none')
  const [customDueDate, setCustomDueDate] = useState('')
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  const [metrcBatchId, setMetrcBatchId] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [strain, setStrain] = useState('')
  const [packageTag, setPackageTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMetrc, setShowMetrc] = useState(false)
  const router = useRouter()

  const nameRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const selected = recipes.find((r) => r.id === selectedId)

  // Auto-focus name input when recipe is selected
  useEffect(() => {
    if (selectedId && nameRef.current) {
      setTimeout(() => nameRef.current?.focus(), 150)
    }
  }, [selectedId])

  const toggleWorker = (id: string) => {
    haptic('light')
    setSelectedWorkers(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!selectedId) { setError('Pick a recipe'); return }
    if (!name.trim()) { setError('Give this batch a name'); return }
    if (batchType === 'fixed' && (!targetQuantity || parseInt(targetQuantity) <= 0)) { setError('Enter a quantity'); return }

    let dueDate: string | undefined
    if (dueDatePreset === 'week') {
      const d = new Date(); d.setDate(d.getDate() + 7)
      dueDate = d.toISOString().split('T')[0]
    } else if (dueDatePreset === 'nextweek') {
      const d = new Date(); d.setDate(d.getDate() + 14)
      dueDate = d.toISOString().split('T')[0]
    } else if (dueDatePreset === 'custom' && customDueDate) {
      dueDate = customDueDate
    }

    haptic('medium')
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: selectedId, name,
          targetQuantity: batchType === 'open' ? null : parseInt(targetQuantity),
          dueDate,
          workerIds: selectedWorkers.length > 0 ? selectedWorkers : undefined,
          metrcBatchId: metrcBatchId || undefined, lotNumber: lotNumber || undefined,
          strain: strain || undefined, packageTag: packageTag || undefined,
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      const data = await res.json()
      router.push(`/batches/${data.batch.id}`)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-8">

      {/* ── Recipe Selection ── */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">Pick a recipe to get started</p>
        <div className="grid gap-2">
          {recipes.map((r) => {
            const isSelected = selectedId === r.id
            return (
              <button
                key={r.id}
                onClick={() => { haptic('light'); setSelectedId(r.id) }}
                disabled={loading}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-emerald-500/10 border-2 border-emerald-500 shadow-sm'
                    : 'bg-card border-2 border-border hover:border-foreground/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.steps.length} steps</span>
                    {isSelected && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Details (shown after recipe selection) ── */}
      {selected && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">

          {/* Batch Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Batch name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g., ${selected.name} - Monday Run`}
              className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all"
              disabled={loading}
            />
          </div>

          {/* Batch Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Batch type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { haptic('medium'); setBatchType('fixed') }}
                disabled={loading}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                  batchType === 'fixed'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500'
                    : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                }`}
              >
                Fixed target
              </button>
              <button
                onClick={() => { haptic('medium'); setBatchType('open') }}
                disabled={loading}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                  batchType === 'open'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                }`}
              >
                Open — count as we go
              </button>
            </div>
            {batchType === 'open' && (
              <p className="text-xs text-muted-foreground/70 mt-2">Workers will log what they produce. Mark the batch done when the run is finished.</p>
            )}
          </div>

          {/* Quantity (only shown for fixed batches) */}
          {batchType === 'fixed' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                How many {selected.baseUnit}?
              </label>
              <input
                ref={qtyRef}
                type="number"
                inputMode="numeric"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                placeholder="0"
                min="1"
                className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-2xl font-bold tabular-nums placeholder:text-muted-foreground/30 placeholder:font-normal placeholder:text-base focus:outline-none focus:border-emerald-500 transition-all"
                disabled={loading}
              />
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Deadline</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'none' as const, label: 'No deadline', sub: '' },
                { key: 'week' as const, label: 'This week', sub: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })() },
                { key: 'nextweek' as const, label: 'Next week', sub: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })() },
                { key: 'custom' as const, label: 'Pick date', sub: '' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { haptic('light'); setDueDatePreset(opt.key) }}
                  disabled={loading}
                  className={`min-h-[48px] px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                    dueDatePreset === opt.key
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500'
                      : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                  }`}
                >
                  <div>{opt.label}</div>
                  {opt.sub && <div className="text-[10px] opacity-60 mt-0.5">{opt.sub}</div>}
                </button>
              ))}
            </div>
            {dueDatePreset === 'custom' && (
              <input
                type="date"
                value={customDueDate}
                onChange={(e) => setCustomDueDate(e.target.value)}
                className="w-full mt-2 px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-base focus:outline-none focus:border-emerald-500 transition-all"
                disabled={loading}
              />
            )}
          </div>

          {/* Workers */}
          {workers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assign team</label>
                <button
                  onClick={() => { haptic('light'); setSelectedWorkers(selectedWorkers.length === workers.length ? [] : workers.map(w => w.id)) }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                >
                  {selectedWorkers.length === workers.length ? 'Clear' : 'All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {workers.map((w) => {
                  const on = selectedWorkers.includes(w.id)
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleWorker(w.id)}
                      disabled={loading}
                      className={`px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium transition-all active:scale-[0.96] ${
                        on
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                      }`}
                    >
                      {w.name}
                    </button>
                  )
                })}
              </div>
              {selectedWorkers.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 mt-2">No one selected = everyone can work on it</p>
              )}
            </div>
          )}

          {/* Tracking (collapsible) */}
          <button
            type="button"
            onClick={() => { haptic('light'); setShowMetrc(!showMetrc) }}
            className="w-full min-h-[44px] py-2.5 rounded-xl text-sm text-muted-foreground font-medium hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className={`w-4 h-4 transition-transform ${showMetrc ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {showMetrc ? 'Hide' : 'Add'} tracking info
          </button>

          {showMetrc && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              {[
                { value: strain, set: setStrain, placeholder: 'Strain' },
                { value: metrcBatchId, set: setMetrcBatchId, placeholder: 'METRC Batch ID' },
                { value: lotNumber, set: setLotNumber, placeholder: 'Lot Number' },
                { value: packageTag, set: setPackageTag, placeholder: 'Package Tag' },
              ].map((f, i) => (
                <input
                  key={i}
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all"
                  disabled={loading}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedId || !name.trim() || (batchType === 'fixed' && !targetQuantity)}
            className="w-full min-h-[52px] py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-base transition-all duration-150 disabled:opacity-30 disabled:bg-muted flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>Create Batch &rarr;</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
