'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Recipe = {
  id: string; name: string; description: string | null
  steps: { id: string; name: string; order: number; notes: string | null }[]
}

type Worker = { id: string; name: string }

export default function BatchCreator({ recipes, workers }: { recipes: Recipe[]; workers: Worker[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
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

  const selected = recipes.find((r) => r.id === selectedId)

  const toggleWorker = (id: string) => {
    setSelectedWorkers(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!selectedId || !name.trim() || !targetQuantity) { setError('All fields required'); return }
    const qty = parseInt(targetQuantity)
    if (qty <= 0) { setError('Quantity must be > 0'); return }

    // Calculate due date from preset
    let dueDate: string | undefined
    if (dueDatePreset === 'week') {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      dueDate = d.toISOString().split('T')[0]
    } else if (dueDatePreset === 'nextweek') {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      dueDate = d.toISOString().split('T')[0]
    } else if (dueDatePreset === 'custom' && customDueDate) {
      dueDate = customDueDate
    }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: selectedId,
          name,
          targetQuantity: qty,
          dueDate,
          workerIds: selectedWorkers.length > 0 ? selectedWorkers : undefined,
          metrcBatchId: metrcBatchId || undefined,
          lotNumber: lotNumber || undefined,
          strain: strain || undefined,
          packageTag: packageTag || undefined,
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      const data = await res.json()
      router.push(`/batches/${data.batch.id}`)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-6">
      {/* Recipe selection */}
      <div>
        <label className="text-sm font-semibold text-foreground mb-2.5 block">1. Choose Recipe</label>
        <div className="space-y-2">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              disabled={loading}
              className={`w-full text-left p-4 min-h-[44px] rounded-lg border-2 transition-all ${
                selectedId === r.id
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                  : 'border-input hover:border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-foreground">{r.name}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-1">{r.steps.length} steps</p>
                </div>
                {selectedId === r.id && (
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Batch name */}
      <div>
        <label className="text-sm font-semibold text-foreground mb-1.5 block">2. Name this batch</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Monday Pre-Rolls, Lot 420"
          className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
          disabled={loading}
        />
      </div>

      {/* 3. Quantity */}
      <div>
        <label className="text-sm font-semibold text-foreground mb-1.5 block">3. How many {selected?.steps?.[0] ? (selected as any).baseUnit || 'units' : 'units'}?</label>
        <input
          type="number"
          inputMode="numeric"
          value={targetQuantity}
          onChange={(e) => setTargetQuantity(e.target.value)}
          placeholder="Target quantity"
          min="1"
          className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-xl font-semibold tabular-nums placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
          disabled={loading}
        />
      </div>

      {/* 4. Due date - quick picks */}
      <div>
        <label className="text-sm font-semibold text-foreground mb-2 block">4. Deadline</label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'none' as const, label: 'No deadline' },
            { key: 'week' as const, label: 'This week' },
            { key: 'nextweek' as const, label: 'Next week' },
            { key: 'custom' as const, label: 'Pick a date' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDueDatePreset(opt.key)}
              disabled={loading}
              className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all ${
                dueDatePreset === opt.key
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/40'
                  : 'bg-card border-2 border-input text-muted-foreground hover:border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {dueDatePreset === 'custom' && (
          <input
            type="date"
            value={customDueDate}
            onChange={(e) => setCustomDueDate(e.target.value)}
            className="w-full mt-2 px-3.5 py-3 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            disabled={loading}
          />
        )}
      </div>

      {/* 5. Worker Assignment */}
      {workers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-foreground">5. Assign workers</label>
            <button
              onClick={() => setSelectedWorkers(selectedWorkers.length === workers.length ? [] : workers.map(w => w.id))}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
            >
              {selectedWorkers.length === workers.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Leave empty = everyone can work on it</p>
          <div className="space-y-2">
            {workers.map((w) => (
              <button
                key={w.id}
                onClick={() => toggleWorker(w.id)}
                disabled={loading}
                className={`w-full flex items-center gap-3 p-3 min-h-[44px] rounded-lg transition-all ${
                  selectedWorkers.includes(w.id)
                    ? 'bg-blue-500/10 border-2 border-blue-500/40'
                    : 'bg-card border-2 border-input hover:border-border'
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                  selectedWorkers.includes(w.id) ? 'bg-blue-600' : 'bg-muted border border-input'
                }`}>
                  {selectedWorkers.includes(w.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tracking & Compliance */}
      <button
        type="button"
        onClick={() => setShowMetrc(!showMetrc)}
        className="w-full min-h-[44px] py-3 rounded-lg border-2 border-dashed border-input text-sm text-muted-foreground font-medium hover:text-foreground hover:border-border transition-colors"
      >
        {showMetrc ? 'Hide Tracking & Compliance' : 'Add Tracking & Compliance'}
      </button>

      {showMetrc && (
        <div className="rounded-lg bg-muted/30 border border-input/50 p-4 space-y-3">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tracking & Compliance</p>
          <input
            type="text"
            value={metrcBatchId}
            onChange={(e) => setMetrcBatchId(e.target.value)}
            placeholder="METRC Batch ID"
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Lot Number"
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
          <input
            type="text"
            value={strain}
            onChange={(e) => setStrain(e.target.value)}
            placeholder="Strain"
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
          <input
            type="text"
            value={packageTag}
            onChange={(e) => setPackageTag(e.target.value)}
            placeholder="Package Tag"
            className="w-full px-3.5 py-3 min-h-[44px] rounded-lg bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
        </div>
      )}

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !selectedId}
        className="w-full min-h-[44px] py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-base transition-all duration-150 disabled:opacity-40 disabled:bg-muted flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating...
          </>
        ) : 'Create Batch'}
      </button>
    </div>
  )
}