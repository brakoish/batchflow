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
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
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

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: selectedId,
          name,
          targetQuantity: qty,
          startDate,
          dueDate: dueDate || undefined,
          workerIds: selectedWorkers.length > 0 ? selectedWorkers : undefined,
          metrcBatchId: metrcBatchId || undefined,
          lotNumber: lotNumber || undefined,
          strain: strain || undefined,
          packageTag: packageTag || undefined,
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      router.push('/dashboard')
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      {/* Recipe selection */}
      <label className="text-xs font-medium text-zinc-400 mb-2.5 block">Recipe</label>
      <div className="space-y-2 mb-4">
        {recipes.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            disabled={loading}
            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
              selectedId === r.id
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-medium text-zinc-50">{r.name}</p>
            {r.description && <p className="text-xs text-zinc-500 mt-0.5">{r.description}</p>}
            <p className="text-[10px] text-zinc-600 mt-1">{r.steps.length} steps</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-3 mb-4">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">Steps</p>
          {selected.steps.map((s) => (
            <p key={s.id} className="text-xs text-zinc-400">
              <span className="text-zinc-600 tabular-nums">{s.order}.</span> {s.name}
            </p>
          ))}
        </div>
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Batch name"
        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-2.5"
        disabled={loading}
      />

      <input
        type="number"
        value={targetQuantity}
        onChange={(e) => setTargetQuantity(e.target.value)}
        placeholder="Target quantity"
        min="1"
        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm font-semibold tabular-nums placeholder:text-zinc-600 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-2.5"
        disabled={loading}
      />

      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-2.5"
        disabled={loading}
      />

      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        placeholder="Due date (optional)"
        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-4"
        disabled={loading}
      />

      {/* METRC Fields Toggle */}
      <button
        type="button"
        onClick={() => setShowMetrc(!showMetrc)}
        className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors mb-2"
      >
        {showMetrc ? 'Hide METRC Fields' : 'Add METRC Fields'}
      </button>

      {showMetrc && (
        <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/50 p-3 mb-4 space-y-2.5">
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">METRC Fields</p>
          <input
            type="text"
            value={metrcBatchId}
            onChange={(e) => setMetrcBatchId(e.target.value)}
            placeholder="METRC Batch ID"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Lot Number"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
          <input
            type="text"
            value={strain}
            onChange={(e) => setStrain(e.target.value)}
            placeholder="Strain"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
          <input
            type="text"
            value={packageTag}
            onChange={(e) => setPackageTag(e.target.value)}
            placeholder="Package Tag"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            disabled={loading}
          />
        </div>
      )}

      {/* Worker Assignment */}
      {workers.length > 0 && (
        <div className="mb-4">
          <label className="text-xs font-medium text-zinc-400 mb-2.5 block">
            Assign Workers <span className="text-zinc-600">(optional — leave empty for all)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {workers.map((w) => (
              <button
                key={w.id}
                onClick={() => toggleWorker(w.id)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedWorkers.includes(w.id)
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !selectedId}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40 disabled:bg-zinc-800"
      >
        {loading ? 'Creating...' : 'Create Batch'}
      </button>
    </div>
  )
}