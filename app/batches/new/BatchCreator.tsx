'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import { emitBatchChanged } from '@/lib/batchEvents'

type Recipe = {
  id: string; name: string; description: string | null; baseUnit: string
  steps: { id: string; name: string; order: number; notes: string | null }[]
}

type Worker = { id: string; name: string }

export default function BatchCreator({ recipes, workers }: { recipes: Recipe[]; workers: Worker[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [batchType, setBatchType] = useState<'fixed' | 'open'>('fixed')
  const [targetQuantity, setTargetQuantity] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [selectedDueDate, setSelectedDueDate] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  const [metrcBatchId, setMetrcBatchId] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [strain, setStrain] = useState('')
  const [packageTag, setPackageTag] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMetrc, setShowMetrc] = useState(false)
  const router = useRouter()

  const nameRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  const selected = recipes.find((r) => r.id === selectedId)
  const fixedTargetInvalid = batchType === 'fixed' && (!targetQuantity || parseInt(targetQuantity) <= 0)

  // Auto-focus name input when recipe is selected
  useEffect(() => {
    if (selectedId && nameRef.current) {
      setTimeout(() => nameRef.current?.focus(), 150)
    }
  }, [selectedId])

  const toggleWorker = (id: string) => {
    haptic('light')
    setSelectedWorkers(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!selectedId) { setError('Pick a recipe'); return }
    if (!name.trim()) { setError('Give this batch a name'); return }
    if (batchType === 'fixed' && (!targetQuantity || parseInt(targetQuantity) <= 0)) { setError('Enter a quantity'); return }

    const dueDate = selectedDueDate || undefined

    haptic('medium')
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: selectedId, name,
          targetQuantity: batchType === 'open' ? null : parseInt(targetQuantity),
          priority,
          dueDate,
          workerIds: selectedWorkers.length > 0 ? selectedWorkers : undefined,
          metrcBatchId: metrcBatchId || undefined, lotNumber: lotNumber || undefined,
          strain: strain || undefined, packageTag: packageTag || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      const data = await res.json()
      emitBatchChanged(data.batch?.id, 'create')
      router.push(`/batches/${data.batch.id}`)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-8">

      {/* ── Recipe Selection ── */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">Pick a recipe to get started</p>
        <div className="grid gap-2">
          {recipes.map((r) => {
            const isSelected = selectedId === r.id
            return (
              <button
                key={r.id}
                onClick={() => { haptic('light'); setSelectedId(r.id) }}
                  disabled={loading}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-150 active:bg-muted/40 ${
                    isSelected
                    ? 'bg-emerald-500/10 border-2 border-emerald-500'
                    : 'bg-card border border-border hover:border-foreground/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.steps.length} steps</span>
                    {isSelected && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Details (shown after recipe selection) ── */}
      {selected && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* What workers will get */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Worker flow</p>
                <p className="text-sm font-semibold text-foreground truncate">{selected.name}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {selected.steps.length} steps
              </span>
            </div>
            <div className="space-y-1.5">
              {selected.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2 rounded-lg bg-muted/45 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card text-[11px] font-bold text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{step.name}</p>
                    {step.notes && <p className="truncate text-[11px] text-muted-foreground">{step.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Batch edits can change steps for one run later without changing this recipe.
            </p>
          </div>

          {/* Batch Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Batch name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g., ${selected.name} - Monday Run`}
              className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all"
              disabled={loading}
            />
          </div>

          {/* Batch Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Batch type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { haptic('medium'); setBatchType('fixed') }}
                disabled={loading}
                className={`bf-select-btn ${
                  batchType === 'fixed'
                    ? 'bf-select-btn-active'
                    : ''
                }`}
              >
                Fixed target
              </button>
              <button
                onClick={() => { haptic('medium'); setBatchType('open') }}
                disabled={loading}
                className={`bf-select-btn ${
                  batchType === 'open'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                    : ''
                }`}
              >
                Open — count as we go
              </button>
            </div>
            {batchType === 'open' && (
              <p className="text-xs text-muted-foreground/70 mt-2">Workers will log what they produce. Mark the batch done when the run is finished.</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => { haptic('light'); setPriority('LOW') }}
                disabled={loading}
                className={`bf-select-btn px-2 text-xs ${
                  priority === 'LOW'
                    ? 'bg-muted/80 text-foreground border-foreground/20'
                    : ''
                }`}
              >
                Low
              </button>
              <button
                onClick={() => { haptic('light'); setPriority('NORMAL') }}
                disabled={loading}
                className={`bf-select-btn px-2 text-xs ${
                  priority === 'NORMAL'
                    ? 'bg-muted/80 text-foreground border-foreground/30'
                    : ''
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => { haptic('light'); setPriority('HIGH') }}
                disabled={loading}
                className={`bf-select-btn px-2 text-xs ${
                  priority === 'HIGH'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-amber-500'
                    : ''
                }`}
              >
                High
              </button>
              <button
                onClick={() => { haptic('light'); setPriority('URGENT') }}
                disabled={loading}
                className={`bf-select-btn px-2 text-xs ${
                  priority === 'URGENT'
                    ? 'bg-red-500/10 text-red-500 dark:text-red-400 border-2 border-red-500'
                    : ''
                }`}
              >
                Urgent
              </button>
            </div>
          </div>

          {/* Quantity (only shown for fixed batches) */}
          {batchType === 'fixed' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                How many {selected.baseUnit}?
              </label>
              <input
                ref={qtyRef}
                type="number"
                inputMode="numeric"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                placeholder="0"
                min="1"
                className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-2xl font-bold tabular-nums placeholder:text-muted-foreground/30 placeholder:font-normal placeholder:text-base focus:outline-none focus:border-emerald-500 transition-all"
                disabled={loading}
              />
            </div>
          )}

          {/* Deadline — inline calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deadline</label>
              {selectedDueDate && (
                <button
                  onClick={() => { haptic('light'); setSelectedDueDate(null) }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick picks */}
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {[
                { label: 'No deadline', date: null },
                { label: 'In 7 days', date: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })() },
                { label: 'In 2 weeks', date: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })() },
              ].map((opt, i) => {
                const dateStr = opt.date ? opt.date.toISOString().split('T')[0] : null
                const isSelected = selectedDueDate === dateStr
                return (
                  <button
                    key={i}
                    onClick={() => { haptic('light'); setSelectedDueDate(dateStr) }}
                    className={`bf-select-btn bf-btn-sm shrink-0 flex-col gap-0 ${
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500'
                        : !selectedDueDate && !dateStr
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500'
                        : ''
                    }`}
                  >
                    <div>{opt.label}</div>
                    {opt.date && <div className="text-[10px] opacity-60">{opt.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
                  </button>
                )
              })}
            </div>

            {/* Calendar */}
            <div className="rounded-xl border-2 border-border bg-card p-3">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => { haptic('light'); setCalendarMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d }) }}
                  className="bf-icon-btn"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-foreground">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => { haptic('light'); setCalendarMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d }) }}
                  className="bf-icon-btn"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground/60 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {(() => {
                  const year = calendarMonth.getFullYear()
                  const month = calendarMonth.getMonth()
                  const firstDay = new Date(year, month, 1)
                  const lastDay = new Date(year, month + 1, 0)
                  // Monday = 0 for our grid
                  let startPad = firstDay.getDay() - 1
                  if (startPad < 0) startPad = 6

                  const today = new Date()
                  today.setHours(0, 0, 0, 0)

                  const days: React.ReactNode[] = []

                  // Padding days from previous month
                  for (let i = 0; i < startPad; i++) {
                    days.push(<div key={`pad-${i}`} />)
                  }

                  // Actual days
                  for (let d = 1; d <= lastDay.getDate(); d++) {
                    const date = new Date(year, month, d)
                    const dateStr = date.toISOString().split('T')[0]
                    const isToday = date.getTime() === today.getTime()
                    const isSelected = selectedDueDate === dateStr
                    const isPast = date < today

                    days.push(
                      <button
                        key={d}
                        onClick={() => {
                          if (!isPast) {
                            haptic('light')
                            setSelectedDueDate(isSelected ? null : dateStr)
                          }
                        }}
                        disabled={isPast || loading}
                        className={`min-h-[40px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors active:bg-muted/40 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : isToday
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                            : isPast
                            ? 'text-muted-foreground/30 cursor-default'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {d}
                      </button>
                    )
                  }

                  return days
                })()}
              </div>

              {/* Selected date display */}
              {selectedDueDate && (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-foreground">
                    Due {new Date(selectedDueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Workers */}
          {workers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assign team</label>
                <button
                  onClick={() => { haptic('light'); setSelectedWorkers(selectedWorkers.length === workers.length ? [] : workers.map(w => w.id)) }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                >
                  {selectedWorkers.length === workers.length ? 'Clear' : 'All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {workers.map((w) => {
                  const on = selectedWorkers.includes(w.id)
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleWorker(w.id)}
                      disabled={loading}
                      className={`bf-select-btn ${
                        on
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100'
                          : ''
                      }`}
                    >
                      {w.name}
                    </button>
                  )
                })}
              </div>
              {selectedWorkers.length === 0 && (
                <p className="text-[11px] text-muted-foreground/60 mt-2">No one selected = everyone can work on it</p>
              )}
            </div>
          )}

          {/* Tracking (collapsible) */}
          {/* Notes */}
          <div>
            <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1.5">Notes <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="Anything the team should know (e.g. flower came in wet, add 1h dry time)"
              disabled={loading}
              autoCapitalize="sentences"
              inputMode="text"
              className="w-full min-h-[88px] px-4 py-3 rounded-xl bg-card border-2 border-border text-foreground text-base placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all resize-y"
            />
            {notes.length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground/70 text-right tabular-nums">{notes.length}/2000</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => { haptic('light'); setShowMetrc(!showMetrc) }}
            className="bf-btn bf-btn-ghost bf-btn-full"
          >
            <svg className={`w-4 h-4 transition-transform ${showMetrc ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {showMetrc ? 'Hide' : 'Add'} tracking info
          </button>

          {showMetrc && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              {[
                { value: strain, set: setStrain, placeholder: 'Strain' },
                { value: metrcBatchId, set: setMetrcBatchId, placeholder: 'METRC Batch ID' },
                { value: lotNumber, set: setLotNumber, placeholder: 'Lot Number' },
                { value: packageTag, set: setPackageTag, placeholder: 'Package Tag' },
              ].map((f, i) => (
                <input
                  key={i}
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-card border-2 border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500 transition-all"
                  disabled={loading}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Review */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Review</p>
                <p className="text-sm font-semibold text-foreground truncate">{name.trim() || 'Unnamed batch'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                priority === 'URGENT'
                  ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20'
                  : priority === 'HIGH'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {priority}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Recipe</p>
                <p className="font-medium text-foreground truncate">{selected.name}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Target</p>
                <p className="font-medium text-foreground truncate">
                  {batchType === 'open' ? 'Open batch' : `${targetQuantity || '0'} ${selected.baseUnit}`}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Due</p>
                <p className="font-medium text-foreground truncate">
                  {selectedDueDate ? new Date(selectedDueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline'}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Team</p>
                <p className="font-medium text-foreground truncate">
                  {selectedWorkers.length ? `${selectedWorkers.length} assigned` : 'Everyone'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedId || !name.trim() || fixedTargetInvalid}
            className="bf-btn bf-btn-success bf-btn-lg bf-btn-full"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>Create Batch &rarr;</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
