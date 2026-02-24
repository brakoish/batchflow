'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, HashtagIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'

type Step = { name: string; notes: string; type: 'CHECK' | 'COUNT' }

export default function RecipeBuilder() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<Step[]>([{ name: '', notes: '', type: 'COUNT' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const addStep = () => setSteps([...steps, { name: '', notes: '', type: 'COUNT' }])
  const removeStep = (i: number) => steps.length > 1 && setSteps(steps.filter((_, idx) => idx !== i))
  const updateStep = (i: number, field: string, value: string) => {
    const s = [...steps]; (s[i] as any)[field] = value; setSteps(s)
  }
  const moveStep = (i: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? i - 1 : i + 1
    if (t < 0 || t >= steps.length) return
    const s = [...steps]; [s[i], s[t]] = [s[t], s[i]]; setSteps(s)
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Recipe name required'); return }
    const valid = steps.filter((s) => s.name.trim())
    if (!valid.length) { setError('Add at least one step'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || undefined, steps: valid }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      setName(''); setDescription(''); setSteps([{ name: '', notes: '', type: 'COUNT' }])
      router.refresh()
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">New Recipe</h2>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Recipe name"
          className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-2.5"
          disabled={loading}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-4"
          disabled={loading}
        />

        {/* Steps */}
        <div className="space-y-2.5 mb-4">
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-zinc-600 font-bold tabular-nums w-4">{i + 1}.</span>
                <input
                  type="text"
                  value={step.name}
                  onChange={(e) => updateStep(i, 'name', e.target.value)}
                  placeholder="Step name"
                  className="flex-1 px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  disabled={loading}
                />
                <div className="flex items-center gap-0.5">
                  <button onClick={() => moveStep(i, 'up')} disabled={i === 0} className="p-1 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1} className="p-1 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeStep(i)} disabled={steps.length === 1} className="p-1 rounded text-zinc-500 hover:text-red-400 disabled:opacity-20 transition-colors">
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Type toggle — segmented control */}
              <div className="flex items-center gap-1 mb-2">
                <button
                  onClick={() => updateStep(i, 'type', 'CHECK')}
                  disabled={loading}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                    step.type === 'CHECK'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <CheckCircleIcon className="w-3 h-3" />Check
                </button>
                <button
                  onClick={() => updateStep(i, 'type', 'COUNT')}
                  disabled={loading}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                    step.type === 'COUNT'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <HashtagIcon className="w-3 h-3" />Count
                </button>
              </div>

              <input
                type="text"
                value={step.notes}
                onChange={(e) => updateStep(i, 'notes', e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                disabled={loading}
              />
            </div>
          ))}
        </div>

        <button
          onClick={addStep}
          disabled={loading}
          className="w-full py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center gap-1 mb-4"
        >
          <PlusIcon className="w-3.5 h-3.5" />Add Step
        </button>

        {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
        >
          {loading ? 'Creating...' : 'Create Recipe'}
        </button>
      </div>
    </div>
  )
}
