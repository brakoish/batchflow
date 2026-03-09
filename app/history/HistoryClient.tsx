'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import EmptyState from '@/app/components/EmptyState'

type Step = { id: string; name: string; order: number; type: string; unitLabel: string; targetQuantity: number; completedQuantity: number; status: string }
type Batch = {
  id: string; name: string; targetQuantity: number; baseUnit: string; status: string
  completedDate: string | null; startDate: string; createdAt: string
  recipe: { name: string }; steps: Step[]
}

export default function HistoryClient({ initialBatches }: { initialBatches: Batch[] }) {
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL')

  const batches = filter === 'ALL'
    ? initialBatches
    : initialBatches.filter(b => b.status === filter)

  return (
    <div>
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? f === 'CANCELLED' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : f === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted text-foreground border border-input'
                : 'text-foreground0 hover:text-muted-foreground'
            }`}
          >
            {f === 'ALL' ? `All (${initialBatches.length})` : `${f.charAt(0) + f.slice(1).toLowerCase()} (${initialBatches.filter(b => b.status === f).length})`}
          </button>
        ))}
      </div>

      {batches.length === 0 ? (
        <EmptyState icon="clock" title="No completed batches yet" description="Batches will appear here when they're marked complete or cancelled" />
      ) : (
        <div className="space-y-2.5">
          {batches.map((batch) => {
            const completedSteps = batch.steps.filter(s => s.status === 'COMPLETED').length
            const pct = Math.round((completedSteps / batch.steps.length) * 100)
            const date = batch.completedDate
              ? new Date(batch.completedDate).toLocaleDateString()
              : new Date(batch.startDate).toLocaleDateString()

            return (
              <Link
                key={batch.id}
                href={`/batches/${batch.id}`}
                className="block rounded-xl border border bg-card p-4 hover:border-input hover:translate-y-[-1px] active:scale-[0.99] transition-all duration-150"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {batch.status === 'COMPLETED' ? (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircleIcon className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{batch.name}</h3>
                      <p className="text-xs text-foreground0 mt-0.5">{batch.recipe.name} · {batch.targetQuantity} {batch.baseUnit}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0 ml-2">{date}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${batch.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-foreground0 tabular-nums">{completedSteps}/{batch.steps.length} steps · {pct}%</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
