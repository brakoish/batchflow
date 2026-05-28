'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon, HashtagIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid'
import RecipeBuilder from './RecipeBuilder'
import EmptyState from '@/app/components/EmptyState'
import ConfirmModal from '@/app/components/ConfirmModal'

type Recipe = {
  id: string; name: string; description: string | null; baseUnit: string
  units: { name: string; ratio: number }[]
  steps: { name: string; notes: string | null; type: string; unit: { name: string } | null; materials: { name: string; quantityPerUnit: number; unit: string }[] }[]
  _count: { batches: number }
}
type ConfirmAction = {
  title: string
  message?: string
  confirmLabel: string
  confirmStyle?: 'danger' | 'primary'
  onConfirm: () => void
}

export default function RecipesClient({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const [recipes, setRecipes] = useState(initialRecipes)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const router = useRouter()

  const editRecipe = editId ? recipes.find(r => r.id === editId) || null : null

  const handleDelete = async (id: string) => {
    const recipe = recipes.find(r => r.id === id)
    setConfirmAction({
      title: 'Delete recipe?',
      message: recipe?._count.batches
        ? 'Recipes connected to batches usually cannot be deleted. If blocked, keep it for history.'
        : `Delete ${recipe?.name || 'this recipe'} from your recipe list.`,
      confirmLabel: 'Delete Recipe',
      confirmStyle: 'danger',
      onConfirm: () => performDelete(id),
    })
  }

  const performDelete = async (id: string) => {
    setConfirmAction(null)
    setDeleting(id)
    setError('')
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRecipes(recipes.filter(r => r.id !== id))
      } else {
        setError((await res.json()).error || 'Failed to delete')
      }
    } catch { setError('Connection error') }
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
          className="bf-btn bf-btn-secondary bf-btn-full"
        >
          Cancel editing — create new instead
        </button>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-medium text-red-500 dark:text-red-400">{error}</p>
        </div>
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
                        className={`bf-icon-btn ${
                          isEditing ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : ''
                        }`}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(recipe.id)} disabled={deleting === recipe.id}
                        className="bf-icon-btn bf-icon-btn-danger">
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

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        confirmStyle={confirmAction?.confirmStyle}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </div>
  )
}
