'use client'

import { useState, useEffect } from 'react'

type Batch = {
  id: string
  name: string
  targetQuantity: number | null
  dueDate?: string
  strain?: string
  lotNumber?: string
  metrcBatchId?: string
  packageTag?: string
  notes?: string | null
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  assignments?: { worker: { id: string; name: string } }[]
  [key: string]: any // Allow additional properties from full Batch type
}

type EditBatchModalProps = {
  batch: Batch | null
  workers: { id: string; name: string }[]
  onClose: () => void
  onSaved: (updatedBatch: Batch) => void
}

export default function EditBatchModal({ batch, workers, onClose, onSaved }: EditBatchModalProps) {
  const [editName, setEditName] = useState('')
  const [editIsOpenEnded, setEditIsOpenEnded] = useState(false)
  const [editTargetQty, setEditTargetQty] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editStrain, setEditStrain] = useState('')
  const [editLotNumber, setEditLotNumber] = useState('')
  const [editMetrcBatchId, setEditMetrcBatchId] = useState('')
  const [editPackageTag, setEditPackageTag] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPriority, setEditPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [editShowMetrc, setEditShowMetrc] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editWorkerIds, setEditWorkerIds] = useState<string[]>([])

  useEffect(() => {
    if (batch) {
      setEditName(batch.name)
      setEditIsOpenEnded(batch.targetQuantity === null)
      setEditTargetQty(batch.targetQuantity?.toString() || '')
      setEditDueDate(batch.dueDate?.split('T')[0] || '')
      setEditStrain(batch.strain || '')
      setEditLotNumber(batch.lotNumber || '')
      setEditMetrcBatchId(batch.metrcBatchId || '')
      setEditPackageTag(batch.packageTag || '')
      setEditNotes(batch.notes || '')
      setEditPriority(batch.priority || 'NORMAL')
      setEditShowMetrc(false)
      setEditWorkerIds(batch.assignments?.map(a => a.worker.id) || [])
      setEditError('')
    }
  }, [batch])

  const handleEditSave = async () => {
    if (!batch || !editName.trim()) return
    if (!editIsOpenEnded && (!editTargetQty || parseInt(editTargetQty) <= 0)) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          targetQuantity: editIsOpenEnded ? null : parseInt(editTargetQty),
          dueDate: editDueDate || undefined,
          strain: editStrain || undefined,
          lotNumber: editLotNumber || undefined,
          metrcBatchId: editMetrcBatchId || undefined,
          packageTag: editPackageTag || undefined,
          notes: editNotes,
          priority: editPriority,
          workerIds: editWorkerIds,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setEditError(data.error || 'Failed to save')
        return
      }
      const data = await res.json()
      onSaved(data.batch)
      onClose()
    } catch {
      setEditError('Network error')
    } finally {
      setEditSaving(false)
    }
  }

  if (!batch) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl safe-bottom max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold text-foreground">Edit Batch</p>
            <button
              onClick={onClose}
              className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Batch Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                autoCapitalize="words"
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
            </div>

            {/* Fixed/Open toggle */}
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1.5">Target Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditIsOpenEnded(false)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${
                    !editIsOpenEnded
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500'
                      : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                  }`}
                >
                  Fixed target
                </button>
                <button
                  type="button"
                  onClick={() => setEditIsOpenEnded(true)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${
                    editIsOpenEnded
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                      : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                  }`}
                >
                  Open — count as we go
                </button>
              </div>
            </div>

            {/* Target quantity */}
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Target Quantity</label>
              <input type="number" inputMode="numeric" value={editTargetQty} onChange={(e) => setEditTargetQty(e.target.value)} min="1"
                disabled={editIsOpenEnded}
                placeholder={editIsOpenEnded ? 'Open-ended' : '0'}
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-40" />
            </div>

            {/* Due date */}
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Due Date</label>
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1.5">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPriority('LOW')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                    editPriority === 'LOW'
                      ? 'bg-muted/80 text-muted-foreground border-2 border-border'
                      : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                  }`}
                >
                  Low
                </button>
                <button
                  type="button"
                  onClick={() => setEditPriority('NORMAL')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                    editPriority === 'NORMAL'
                      ? 'bg-muted/80 text-foreground border-2 border-foreground/30'
                      : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setEditPriority('HIGH')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                    editPriority === 'HIGH'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-amber-500'
                      : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                  }`}
                >
                  High
                </button>
                <button
                  type="button"
                  onClick={() => setEditPriority('URGENT')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                    editPriority === 'URGENT'
                      ? 'bg-red-500/10 text-red-500 dark:text-red-400 border-2 border-red-500'
                      : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                  }`}
                >
                  Urgent
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value.slice(0, 2000))}
                rows={3}
                autoCapitalize="sentences"
                inputMode="text"
                placeholder="Anything the team should know (e.g. flower came in wet, add 1h dry time)"
                className="w-full min-h-[88px] px-3 py-2 rounded-lg bg-muted border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-y"
              />
              {editNotes.length > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground/70 text-right tabular-nums">{editNotes.length}/2000</p>
              )}
            </div>

            {/* METRC (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setEditShowMetrc(!editShowMetrc)}
                className="w-full min-h-[44px] py-2 rounded-lg text-xs text-muted-foreground font-medium hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className={`w-4 h-4 transition-transform ${editShowMetrc ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {editShowMetrc ? 'Hide' : 'Edit'} tracking info
              </button>
              {editShowMetrc && (
                <div className="space-y-2 pt-1">
                  <input type="text" value={editStrain} onChange={(e) => setEditStrain(e.target.value)} placeholder="Strain"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <input type="text" value={editMetrcBatchId} onChange={(e) => setEditMetrcBatchId(e.target.value)} placeholder="METRC Batch ID"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <input type="text" value={editLotNumber} onChange={(e) => setEditLotNumber(e.target.value)} placeholder="Lot Number"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <input type="text" value={editPackageTag} onChange={(e) => setEditPackageTag(e.target.value)} placeholder="Package Tag"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-input text-foreground text-base placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                </div>
              )}
            </div>

            {/* Assigned workers */}
            {workers.length > 0 && (
              <div>
                <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1.5">Assigned Workers</label>
                <div className="flex flex-wrap gap-2">
                  {workers.map((w) => {
                    const selected = editWorkerIds.includes(w.id)
                    return (
                      <button key={w.id} type="button"
                        onClick={() => setEditWorkerIds(prev => selected ? prev.filter(id => id !== w.id) : [...prev, w.id])}
                        className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-all active:scale-[0.96] ${
                          selected
                            ? 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border border-input hover:border-foreground/20'
                        }`}>
                        {w.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {editError && <p className="text-red-500 dark:text-red-400 text-xs text-center">{editError}</p>}

            <button
              onClick={handleEditSave}
              disabled={editSaving || !editName.trim() || (!editIsOpenEnded && (!editTargetQty || parseInt(editTargetQty) <= 0))}
              className="w-full py-3.5 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
            >
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
