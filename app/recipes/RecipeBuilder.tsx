'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = {
  name: string
  notes: string
}

export default function RecipeBuilder() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<Step[]>([{ name: '', notes: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const addStep = () => {
    setSteps([...steps, { name: '', notes: '' }])
  }

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index))
    }
  }

  const updateStep = (
    index: number,
    field: 'name' | 'notes',
    value: string
  ) => {
    const newSteps = [...steps]
    newSteps[index][field] = value
    setSteps(newSteps)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return
    }

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSteps[index], newSteps[targetIndex]] = [
      newSteps[targetIndex],
      newSteps[index],
    ]
    setSteps(newSteps)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Recipe name is required')
      return
    }

    const validSteps = steps.filter((s) => s.name.trim())
    if (validSteps.length === 0) {
      setError('At least one step is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          steps: validSteps,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create recipe')
        return
      }

      // Reset form
      setName('')
      setDescription('')
      setSteps([{ name: '', notes: '' }])
      router.refresh()
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-6">
        Create New Recipe
      </h2>

      {/* Recipe Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Recipe Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., 14g Ground Flower"
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
      </div>

      {/* Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-zinc-400">
            Steps *
          </label>
          <button
            onClick={addStep}
            disabled={loading}
            className="text-green-500 hover:text-green-400 text-sm font-medium"
          >
            + Add Step
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-zinc-800 rounded-xl p-4 border border-zinc-700"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-zinc-500 font-semibold text-sm w-6">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  value={step.name}
                  onChange={(e) => updateStep(index, 'name', e.target.value)}
                  placeholder="Step name"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveStep(index, 'up')}
                    disabled={loading || index === 0}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-zinc-400 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStep(index, 'down')}
                    disabled={loading || index === steps.length - 1}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-zinc-400 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeStep(index)}
                    disabled={loading || steps.length === 1}
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-900/50 text-red-400 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={step.notes}
                onChange={(e) => updateStep(index, 'notes', e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={loading}
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Recipe'}
      </button>
    </div>
  )
}
