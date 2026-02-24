'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import {
  LockClosedIcon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
} from '@heroicons/react/24/solid'

type Worker = { id: string; name: string }
type ProgressLog = {
  id: string; quantity: number; note: string | null; createdAt: string; worker: Worker
}
type BatchStep = {
  id: string; name: string; order: number; type: 'CHECK' | 'COUNT'
  unitLabel: string; unitRatio: number
  targetQuantity: number; completedQuantity: number; status: string
  recipeStep?: { notes: string | null }
  progressLogs: ProgressLog[]
}
type Batch = {
  id: string; name: string; targetQuantity: number; baseUnit: string; status: string
  recipe: { name: string }; steps: BatchStep[]
}
type Session = { id: string; name: string; role: string }

export default function BatchDetailClient({
  batch: initialBatch, session,
}: {
  batch: Batch; session: Session
}) {
  const [batch, setBatch] = useState(initialBatch)
  const [selectedStep, setSelectedStep] = useState<BatchStep | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const quantityRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const fetchBatch = async () => {
      try {
        const res = await fetch(`/api/batches/${batch.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.batch) setBatch(data.batch)
        }
      } catch {}
    }

    pollRef.current = setInterval(fetchBatch, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [batch.id])
  const router = useRouter()

  useEffect(() => {
    if (selectedStep && quantityRef.current) {
      quantityRef.current.focus()
    }
  }, [selectedStep])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const handleCheckComplete = async (step: BatchStep) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${step.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: step.targetQuantity }),
      })
      if (!res.ok) { setError((await res.json()).error); return }

      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map((s) => {
          if (s.id === step.id) return { ...s, completedQuantity: s.targetQuantity, status: 'COMPLETED' }
          if (s.order === step.order + 1 && s.status === 'LOCKED') return { ...s, status: 'IN_PROGRESS' }
          return s
        }),
      }))
      showToast(`${step.name} complete`)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!selectedStep || !quantity || parseInt(quantity) <= 0) {
      setError('Enter a valid quantity'); return
    }
    setLoading(true); setError('')

    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${selectedStep.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseInt(quantity), note: note || undefined }),
      })
      if (!res.ok) { setError((await res.json()).error); return }

      const qty = parseInt(quantity)
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map((s) => {
          if (s.id === selectedStep.id) {
            const newQty = s.completedQuantity + qty
            return { ...s, completedQuantity: newQty, status: newQty >= s.targetQuantity ? 'COMPLETED' : s.status }
          }
          if (s.order === selectedStep.order + 1 && s.status === 'LOCKED') return { ...s, status: 'IN_PROGRESS' }
          return s
        }),
      }))

      showToast(`Logged ${qty} units`)
      setSelectedStep(null); setQuantity(''); setNote('')
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const getPrevCompleted = (order: number) => {
    if (order === 1) return batch.targetQuantity
    return batch.steps.find((s) => s.order === order - 1)?.completedQuantity || 0
  }

  const overallPct = Math.round(
    (batch.steps.filter(s => s.status === 'COMPLETED').length / batch.steps.length) * 100
  )

  return (
    <div className="min-h-dvh bg-zinc-950">
      <Header session={session} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium shadow-lg">
            <CheckCircleIcon className="w-4 h-4" />
            {toast}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5">
        {/* Batch header */}
        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">{batch.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-500">{batch.recipe.name}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">{batch.targetQuantity} {batch.baseUnit}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-emerald-400 font-medium">{overallPct}%</span>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {batch.steps.map((step) => {
            const isLocked = step.status === 'LOCKED'
            const isCompleted = step.status === 'COMPLETED'
            const pct = (step.completedQuantity / step.targetQuantity) * 100

            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 transition-all duration-150 ${
                  isLocked
                    ? 'border-zinc-800/50 bg-zinc-900/50 opacity-50'
                    : isCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: status icon + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/15'
                        : isLocked
                        ? 'bg-zinc-800'
                        : 'bg-blue-500/15'
                    }`}>
                      {isCompleted ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                      ) : isLocked ? (
                        <LockClosedIcon className="w-3.5 h-3.5 text-zinc-600" />
                      ) : (
                        <span className="text-xs font-bold text-blue-400">{step.order}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isCompleted ? 'text-emerald-300' : isLocked ? 'text-zinc-600' : 'text-zinc-50'
                      }`}>
                        {step.name}
                      </p>
                      {step.recipeStep?.notes && !isLocked && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">{step.recipeStep.notes}</p>
                      )}
                      {step.type === 'COUNT' && !isLocked && (
                        <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                          {step.completedQuantity} / {step.targetQuantity} {step.unitLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: action or status */}
                  {!isLocked && !isCompleted && step.type === 'COUNT' && (
                    <button
                      onClick={() => { setSelectedStep(step); setQuantity(''); setNote(''); setError('') }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-xs font-semibold transition-all duration-150 shrink-0"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />Log
                    </button>
                  )}
                  {!isLocked && !isCompleted && step.type === 'CHECK' && (
                    <button
                      onClick={() => handleCheckComplete(step)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.96] text-white text-xs font-semibold transition-all duration-150 shrink-0 disabled:opacity-50"
                    >
                      <CheckIcon className="w-3.5 h-3.5" />Done
                    </button>
                  )}
                </div>

                {/* Progress bar for COUNT steps */}
                {step.type === 'COUNT' && !isLocked && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Log Modal */}
      {selectedStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-zinc-50">{selectedStep.name}</p>
                  <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                    {selectedStep.completedQuantity} / {selectedStep.targetQuantity} {selectedStep.unitLabel}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStep(null)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quantity */}
              <input
                ref={quantityRef}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                className="w-full px-4 py-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-xl font-semibold tabular-nums placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />

              {/* Quick add */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[50, 100, 250].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setQuantity(String((parseInt(quantity) || 0) + amt))}
                    className="py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 text-sm font-medium active:scale-[0.96] transition-all duration-150"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Note */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full mt-3 px-3.5 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-50 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />

              {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !quantity || parseInt(quantity) <= 0}
                className="w-full mt-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40 disabled:bg-zinc-800"
              >
                {loading ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
