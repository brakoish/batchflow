'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, HashtagIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid'
import RecipeBuilder from './RecipeBuilder'
import EmptyState from '@/app/components/EmptyState'

type Recipe = {
  id: string; name: string; description: string | null; baseUnit: string
  units: { name: string; ratio: number }[]
  steps: { name: string; notes: string | null; type: string; unit: { name: string } | null; materials: { name: string; quantityPerUnit: number; unit: string }[] }[]
  _count: { batches: number }
}

export default function RecipesClient({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const [recipes, setRecipes] = useState(initialRecipes)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  const editRecipe = editId ? recipes.find(r => r.id === editId) || null : null

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRecipes(recipes.filter(r => r.id !== id))
      } else {
        alert((await res.json()).error || 'Failed to delete')
      }
    } catch { alert('Connection error') }
    finally { setDeleting(null) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Builder — always on top */}
      <RecipeBuilder
        key={editId || 'new'}
        editRecipe={editRecipe}
        onDone={() => { setEditId(null); router.refresh() }}
      />

      {/* Cancel edit button */}
      {editId && (
        <button
          onClick={() => setEditId(null)}
          className="w-full py-3 rounded-xl border-2 border-border text-sm text-muted-foreground font-medium hover:text-foreground hover:border-foreground/20 transition-all"
        >
          Cancel editing — create new instead
        </button>
      )}

      {/* Existing Recipes */}
      {recipes.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Your Recipes</h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-3">
            {recipes.map((recipe) => {
              const isEditing = editId === recipe.id
              return (
                <div
                  key={recipe.id}
                  className={`rounded-xl border bg-card p-4 transition-all ${
                    isEditing ? 'border-emerald-500 bg-emerald-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{recipe.name}</h3>
                        {isEditing && (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Editing ↑
                          </span>
                        )}
                      </div>
                      {recipe.description && <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground/60">Base: {recipe.baseUnit}</span>
                        {recipe.units.map((u, i) => (
                          <span key={i} className="text-[10px] text-muted-foreground/60">· {u.name} = {u.ratio} {recipe.baseUnit}</span>
                        ))}
                        <span className="text-[10px] text-muted-foreground/60">· {recipe._count.batches} batch{recipe._count.batches !== 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <button
                        onClick={() => {
                          setEditId(isEditing ? null : recipe.id)
                          if (!isEditing) window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-colors ${
                          isEditing ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(recipe.id)} disabled={deleting === recipe.id}
                        className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Steps list */}
                  <div className="space-y-0.5">
                    {recipe.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground/50 tabular-nums w-4">{i + 1}.</span>
                        <span className="text-foreground/80">{step.name}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${
                          step.type === 'CHECK' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}>
                          {step.type === 'CHECK' ? <><CheckCircleIcon className="w-2.5 h-2.5" />Check</> : <><HashtagIcon className="w-2.5 h-2.5" />{step.unit?.name || recipe.baseUnit}</>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
