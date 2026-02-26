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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Existing */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Existing</h2>
        {recipes.length === 0 ? (
          <EmptyState icon="beaker" title="No recipes yet" description="Create your first recipe to get started" />
        ) : (
          recipes.map((recipe) => (
            <div key={recipe.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50">{recipe.name}</h3>
                  {recipe.description && <p className="text-xs text-zinc-500 mt-0.5">{recipe.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-zinc-600">Base: {recipe.baseUnit}</span>
                    {recipe.units.map((u, i) => (
                      <span key={i} className="text-[10px] text-zinc-600">· {u.name} = {u.ratio} {recipe.baseUnit}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => setEditId(editId === recipe.id ? null : recipe.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(recipe.id)} disabled={deleting === recipe.id}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-40">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-zinc-600 ml-1 tabular-nums">{recipe._count.batches}</span>
                </div>
              </div>
              <div className="space-y-0.5">
                {recipe.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-600 tabular-nums w-4">{i + 1}.</span>
                    <span className="text-zinc-300">{step.name}</span>
                    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${
                      step.type === 'CHECK' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {step.type === 'CHECK' ? <><CheckCircleIcon className="w-2.5 h-2.5" />Check</> : <><HashtagIcon className="w-2.5 h-2.5" />{step.unit?.name || recipe.baseUnit}</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Builder */}
      <RecipeBuilder
        key={editId || 'new'}
        editRecipe={editRecipe}
        onDone={() => { setEditId(null); router.refresh() }}
      />
    </div>
  )
}
