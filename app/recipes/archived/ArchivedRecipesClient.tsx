'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowPathIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'

type ArchivedRecipe = {
  id: string
  name: string
  description: string | null
  archivedAt: string
  _count: { batches: number }
}

export default function ArchivedRecipesClient({ initialRecipes }: { initialRecipes: ArchivedRecipe[] }) {
  const [recipes, setRecipes] = useState(initialRecipes)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const restore = async (recipe: ArchivedRecipe) => {
    setRestoring(recipe.id)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error || 'Could not restore recipe')
        return
      }

      setRecipes(current => current.filter(item => item.id !== recipe.id))
      setMessage(`${recipe.name} restored and ready for new batches.`)
      window.setTimeout(() => setMessage(''), 4000)
    } catch {
      setError('Connection error')
    } finally {
      setRestoring(null)
    }
  }

  if (recipes.length === 0) {
    return (
      <>
        {message && (
          <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-xl border border-emerald-500/30 bg-emerald-600 px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-white">{message}</p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ArchiveBoxIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No archived recipes</p>
          <p className="mt-1 text-xs text-muted-foreground">Removed recipes with batch history will appear here.</p>
          <Link href="/recipes" className="bf-btn bf-btn-primary mt-4">Back to Recipes</Link>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}
      {message && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-xl border border-emerald-500/30 bg-emerald-600 px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-white">{message}</p>
        </div>
      )}

      {recipes.map(recipe => (
        <div key={recipe.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">{recipe.name}</h2>
              {recipe.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{recipe.description}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                History preserved for {recipe._count.batches} batch{recipe._count.batches === 1 ? '' : 'es'}
              </p>
            </div>
            <button
              onClick={() => restore(recipe)}
              disabled={restoring === recipe.id}
              className="bf-btn bf-btn-primary shrink-0"
            >
              <ArrowPathIcon className={`h-4 w-4 ${restoring === recipe.id ? 'animate-spin' : ''}`} />
              {restoring === recipe.id ? 'Restoring' : 'Restore'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
