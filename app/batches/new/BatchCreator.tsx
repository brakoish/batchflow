'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Recipe = {
  id: string
  name: string
  description: string | null
  steps: {
    id: string
    name: string
    order: number
    notes: string | null
  }[]
}

export default function BatchCreator({ recipes }: { recipes: Recipe[] }) {
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [name, setName] = useState('')
  const [targetQuantity, setTargetQuantity] = useState('')
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId)

  const handleSubmit = async () => {
    if (!selectedRecipeId || !name.trim() || !targetQuantity) {
      setError('All fields are required')
      return
    }

    const qty = parseInt(targetQuantity)
    if (qty <= 0) {
      setError('Target quantity must be greater than 0')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId: selectedRecipeId,
          name,
          targetQuantity: qty,
          startDate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create batch')
        return
      }

      router.push('/dashboard')
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      {/* Recipe Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-3">
          Select Recipe *
        </label>
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(recipe.id)}
              disabled={loading}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                selectedRecipeId === recipe.id
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="font-semibold text-white mb-1">{recipe.name}</div>
              {recipe.description && (
                <div className="text-sm text-zinc-400 mb-2">
                  {recipe.description}
                </div>
              )}
              <div className="text-xs text-zinc-500">
                {recipe.steps.length} steps
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Steps Preview */}
      {selectedRecipe && (
        <div className="mb-6 bg-zinc-800 rounded-xl p-4 border border-zinc-700">
          <p className="text-xs text-zinc-500 font-medium mb-2">
            Recipe Steps:
          </p>
          <div className="space-y-1">
            {selectedRecipe.steps.map((step) => (
              <div key={step.id} className="flex items-start gap-2 text-sm">
                <span className="text-zinc-600 font-medium">{step.order}.</span>
                <div className="flex-1">
                  <span className="text-zinc-300">{step.name}</span>
                  {step.notes && (
                    <p className="text-zinc-500 text-xs mt-0.5">{step.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Batch Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., 14g Ground Flower Batch #047"
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
      </div>

      {/* Target Quantity */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Target Quantity *
        </label>
        <input
          type="number"
          value={targetQuantity}
          onChange={(e) => setTargetQuantity(e.target.value)}
          placeholder="500"
          min="1"
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
      </div>

      {/* Start Date */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Start Date *
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !selectedRecipeId}
        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold text-lg transition-colors disabled:opacity-50 disabled:bg-zinc-800"
      >
        {loading ? 'Creating...' : 'Create Batch'}
      </button>
    </div>
  )
}
