'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import {
  LockClosedIcon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid'

type Worker = { id: string; name: string }
type ProgressLog = {
  id: string; quantity: number; note: string | null; createdAt: string; worker: Worker
}
type StepMaterial = { name: string; quantityPerUnit: number; unit: string }
type BatchStep = {
  id: string; name: string; order: number; type: 'CHECK' | 'COUNT'
  unitLabel: string; unitRatio: number
  targetQuantity: number; completedQuantity: number; status: string
  recipeStep?: { notes: string | null; materials?: StepMaterial[] }
  progressLogs: ProgressLog[]
}
type Batch = {
  id: string; name: string; targetQuantity: number; baseUnit: string; status: string
  dueDate?: string
  metrcBatchId?: string
  lotNumber?: string
  strain?: string
  packageTag?: string
  recipe: { name: string }; steps: BatchStep[]
  assignments?: { worker: Worker }[]
}
type Session = { id: string; name: string; role: string }

// Smart increment buttons that adapt to remaining quantity
function QuickAddButtons({ remaining, current, onAdd }: { remaining: number; current: number; onAdd: (val: number) => void }) {
  // Don't show buttons if nothing remaining
  if (remaining <= 0) return null

  // Calculate smart increments based on remaining quantity
  const increments = (() => {
    // Small batch: <= 50
    if (remaining <= 50) {
      if (remaining <= 10) return [remaining]
      if (remaining <= 25) return [10, remaining]
      return [10, 25, remaining]
    }
    // Medium batch: 51-200
    if (remaining <= 200) {
      if (remaining <= 100) return [25, 50, remaining]
      return [50, 100, remaining]
    }
    // Large batch: 201-500
    if (remaining <= 500) {
      return [50, 100, 250].filter(n => n < remaining).concat([remaining])
    }
    // Very large batch: > 500
    return [100, 250, 500]
  })()

  // Remove duplicates and sort
  const unique = Array.from(new Set(increments)).sort((a, b) => a - b).slice(0, 3)

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {unique.map((amt) => (
        <button
          key={amt}
          onClick={() => onAdd(current + amt)}
          className={`py-2.5 rounded-lg border text-sm font-medium active:scale-[0.96] transition-all duration-150 ${
            amt === remaining
              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30'
              : 'bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-zinc-300'
          }`}
        >
          {amt === remaining ? 'Rest' : `+${amt}`}
        </button>
      ))}
    </div>
  )
}

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
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState(batch.name)
  const [editTargetQty, setEditTargetQty] = useState(batch.targetQuantity.toString())
  const [editDueDate, setEditDueDate] = useState(batch.dueDate?.split('T')[0] || '')
  const [editMetrcBatchId, setEditMetrcBatchId] = useState(batch.metrcBatchId || '')
  const [editLotNumber, setEditLotNumber] = useState(batch.lotNumber || '')
  const [editStrain, setEditStrain] = useState(batch.strain || '')
  const [editPackageTag, setEditPackageTag] = useState(batch.packageTag || '')
  const [editWorkerIds, setEditWorkerIds] = useState<string[]>(batch.assignments?.map(a => a.worker.id) || [])

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

  const handleStatusChange = async (status: string) => {
    const labels: Record<string, string> = { COMPLETED: 'complete', CANCELLED: 'cancel', ACTIVE: 'reopen' }
    if (!confirm(`Are you sure you want to ${labels[status] || status} this batch?`)) return
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      setBatch(prev => ({ ...prev, status }))
      showToast(`Batch ${labels[status]}d`)
    } catch { setError('Connection error') }
  }

  const handleDeleteLog = async (logId: string, stepId: string, qty: number) => {
    if (!confirm(`Delete this log entry (+${qty})?`)) return
    try {
      const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      // Optimistically update
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            return {
              ...s,
              completedQuantity: Math.max(0, s.completedQuantity - qty),
              progressLogs: s.progressLogs.filter(l => l.id !== logId),
            }
          }
          return s
        }),
      }))
      showToast('Log entry deleted')
    } catch { setError('Connection error') }
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

  const handleEditSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          targetQuantity: parseInt(editTargetQty),
          dueDate: editDueDate || undefined,
          workerIds: editWorkerIds,
          metrcBatchId: editMetrcBatchId || undefined,
          lotNumber: editLotNumber || undefined,
          strain: editStrain || undefined,
          packageTag: editPackageTag || undefined,
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      const data = await res.json()
      setBatch(data.batch)
      setShowEditModal(false)
      showToast('Batch updated')
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
    <AppShell session={session}>


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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-zinc-500">{batch.recipe.name}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">{batch.targetQuantity} {batch.baseUnit}</span>
            {batch.dueDate && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-500">Due: {new Date(batch.dueDate).toLocaleDateString()}</span>
              </>
            )}
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-emerald-400 font-medium">{overallPct}%</span>
            {batch.status !== 'ACTIVE' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                batch.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {batch.status}
              </span>
            )}
          </div>
          
          {/* METRC Fields Display */}
          {(batch.metrcBatchId || batch.lotNumber || batch.strain || batch.packageTag) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {batch.metrcBatchId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">METRC: {batch.metrcBatchId}</span>
              )}
              {batch.lotNumber && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Lot: {batch.lotNumber}</span>
              )}
              {batch.strain && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{batch.strain}</span>
              )}
              {batch.packageTag && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Tag: {batch.packageTag}</span>
              )}
            </div>
          )}

          {/* Owner batch controls */}
          {session.role === 'OWNER' && batch.status === 'ACTIVE' && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleStatusChange('COMPLETED')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-xs font-medium transition-all">
                Mark Complete
              </button>
              <button onClick={() => setShowEditModal(true)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 active:scale-[0.96] text-zinc-300 text-xs font-medium transition-all">
                Edit Batch
              </button>
              <button onClick={() => handleStatusChange('CANCELLED')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 active:scale-[0.96] text-red-400 text-xs font-medium transition-all">
                Cancel Batch
              </button>
            </div>
          )}
          {session.role === 'OWNER' && batch.status !== 'ACTIVE' && (
            <button onClick={() => handleStatusChange('ACTIVE')}
              className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 active:scale-[0.96] text-blue-400 text-xs font-medium transition-all">
              Reopen Batch
            </button>
          )}
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
                      className="flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />Log
                    </button>
                  )}
                  {!isLocked && !isCompleted && step.type === 'CHECK' && (
                    <button
                      onClick={() => handleCheckComplete(step)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 shrink-0 disabled:opacity-50"
                    >
                      <CheckIcon className="w-4 h-4" />Done
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

                {/* Materials needed for this step */}
                {step.recipeStep?.materials && step.recipeStep.materials.length > 0 && !isLocked && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Materials Needed</span>
                    <div className="mt-1.5 space-y-1">
                      {step.recipeStep.materials.map((mat, idx) => {
                        const total = (mat.quantityPerUnit * step.targetQuantity).toLocaleString()
                        return (
                          <div key={idx} className="text-[11px] text-zinc-400">
                            <span className="text-zinc-300">{mat.name}:</span>{' '}
                            1 {step.unitLabel.slice(0, -1)} is {mat.quantityPerUnit}{mat.unit} → Total: {total}{mat.unit}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recent logs */}
                {step.progressLogs && step.progressLogs.length > 0 && !isLocked && (
                  <div className="mt-3 space-y-1">
                    {step.progressLogs.slice(0, 3).map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-[10px] text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400 font-medium">{log.worker.name}</span>
                          <span className="text-emerald-400 tabular-nums">+{log.quantity}</span>
                          {log.note && <span className="text-zinc-600 truncate max-w-[120px]">{log.note}</span>}
                          <span className="text-zinc-700">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {(session.role === 'OWNER' || session.id === log.worker.id) && (
                          <button
                            onClick={() => handleDeleteLog(log.id, step.id, log.quantity)}
                            className="flex items-center justify-center w-8 h-8 min-w-[32px] rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800/50 transition-colors"
                            title="Delete this log"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
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

              {/* Quick add - smart increments based on remaining quantity */}
              <QuickAddButtons
                remaining={selectedStep.targetQuantity - selectedStep.completedQuantity}
                current={parseInt(quantity) || 0}
                onAdd={(val) => setQuantity(String(val))}
              />

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

      {/* Edit Batch Modal */}
      {showEditModal && session.role === 'OWNER' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl safe-bottom max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-zinc-50">Edit Batch</p>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-1">Batch Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-1">Target Quantity</label>
                  <input
                    type="number"
                    value={editTargetQty}
                    onChange={(e) => setEditTargetQty(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {/* METRC Fields */}
                <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">METRC Fields</p>
                  <input
                    type="text"
                    value={editMetrcBatchId}
                    onChange={(e) => setEditMetrcBatchId(e.target.value)}
                    placeholder="METRC Batch ID"
                    className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                  <input
                    type="text"
                    value={editLotNumber}
                    onChange={(e) => setEditLotNumber(e.target.value)}
                    placeholder="Lot Number"
                    className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                  <input
                    type="text"
                    value={editStrain}
                    onChange={(e) => setEditStrain(e.target.value)}
                    placeholder="Strain"
                    className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                  <input
                    type="text"
                    value={editPackageTag}
                    onChange={(e) => setEditPackageTag(e.target.value)}
                    placeholder="Package Tag"
                    className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-50 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                <button
                  onClick={handleEditSave}
                  disabled={loading || !editName.trim() || !editTargetQty}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
