'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import ConfirmModal from '@/app/components/ConfirmModal'
import { emitBatchChanged } from '@/lib/batchEvents'
import type { Session } from '@/lib/session'

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type Worker = { id: string; name: string }
type Step = {
  id: string; name: string; order: number; type: 'COUNT' | 'CHECK'; unitLabel: string
  unitRatio: number; targetQuantity: number | null; completedQuantity: number; status: string
}
type Batch = {
  id: string; name: string; targetQuantity: number | null; status: string; priority: Priority
  dueDate?: string | null; strain?: string | null; lotNumber?: string | null
  metrcBatchId?: string | null; packageTag?: string | null; notes?: string | null
  recipe: { id: string; name: string }; assignments: { worker: Worker }[]; steps: Step[]
}

const SKIPPED_PREFIX = '[Skipped] '
const cleanStepName = (name: string) => name.startsWith(SKIPPED_PREFIX) ? name.slice(SKIPPED_PREFIX.length) : name

function Section({ title, summary, children, defaultOpen = false }: {
  title: string; summary: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{summary}</span>
        </span>
        <span className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && <div className="space-y-4 border-t border-border p-4">{children}</div>}
    </section>
  )
}

const inputClass = 'w-full min-h-[48px] rounded-xl border border-input bg-muted px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground'

export default function ManageBatchClient({ initialBatch, workers, session, duplicate }: {
  initialBatch: Batch; workers: Worker[]; session: Session; duplicate: boolean
}) {
  const router = useRouter()
  const [batch, setBatch] = useState(initialBatch)
  const [name, setName] = useState(duplicate ? `${initialBatch.name} (copy)` : initialBatch.name)
  const [openEnded, setOpenEnded] = useState(initialBatch.targetQuantity === null)
  const [target, setTarget] = useState(initialBatch.targetQuantity?.toString() || '')
  const [dueDate, setDueDate] = useState(initialBatch.dueDate?.split('T')[0] || '')
  const [priority, setPriority] = useState<Priority>(initialBatch.priority || 'NORMAL')
  const [strain, setStrain] = useState(initialBatch.strain || '')
  const [lotNumber, setLotNumber] = useState(initialBatch.lotNumber || '')
  const [metrcBatchId, setMetrcBatchId] = useState(initialBatch.metrcBatchId || '')
  const [packageTag, setPackageTag] = useState(initialBatch.packageTag || '')
  const [notes, setNotes] = useState(initialBatch.notes || '')
  const [workerIds, setWorkerIds] = useState(initialBatch.assignments.map((a) => a.worker.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [stepDraft, setStepDraft] = useState({ name: '', type: 'COUNT' as 'COUNT' | 'CHECK', target: '', unitLabel: 'units' })
  const [addingStep, setAddingStep] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; action: () => void } | null>(null)

  const original = useMemo(() => JSON.stringify({
    name: duplicate ? `${initialBatch.name} (copy)` : initialBatch.name,
    openEnded: initialBatch.targetQuantity === null,
    target: initialBatch.targetQuantity?.toString() || '', dueDate: initialBatch.dueDate?.split('T')[0] || '',
    priority: initialBatch.priority || 'NORMAL', strain: initialBatch.strain || '', lotNumber: initialBatch.lotNumber || '',
    metrcBatchId: initialBatch.metrcBatchId || '', packageTag: initialBatch.packageTag || '', notes: initialBatch.notes || '',
    workerIds: initialBatch.assignments.map((a) => a.worker.id).sort(),
  }), [initialBatch, duplicate])
  const current = JSON.stringify({ name, openEnded, target, dueDate, priority, strain, lotNumber, metrcBatchId, packageTag, notes, workerIds: [...workerIds].sort() })
  const dirty = current !== original

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  const save = async () => {
    if (!name.trim()) return setError('Batch name is required')
    if (!openEnded && (!target || Number(target) <= 0 || !Number.isInteger(Number(target)))) return setError('Enter a whole-number target greater than 0')
    setSaving(true); setError('')
    try {
      const fullPayload = {
        name: name.trim(), targetQuantity: openEnded ? null : Number(target), dueDate: dueDate || null,
        priority, strain: strain.trim() || null, lotNumber: lotNumber.trim() || null,
        metrcBatchId: metrcBatchId.trim() || null, packageTag: packageTag.trim() || null,
        notes: notes.trim() || null, workerIds,
      }
      const payload: Record<string, unknown> = duplicate ? fullPayload : {}
      if (!duplicate) {
        if (name.trim() !== initialBatch.name) payload.name = name.trim()
        if ((openEnded ? null : Number(target)) !== initialBatch.targetQuantity) payload.targetQuantity = openEnded ? null : Number(target)
        if ((dueDate || null) !== (initialBatch.dueDate?.split('T')[0] || null)) payload.dueDate = dueDate || null
        if (priority !== (initialBatch.priority || 'NORMAL')) payload.priority = priority
        if ((strain.trim() || null) !== (initialBatch.strain || null)) payload.strain = strain.trim() || null
        if ((lotNumber.trim() || null) !== (initialBatch.lotNumber || null)) payload.lotNumber = lotNumber.trim() || null
        if ((metrcBatchId.trim() || null) !== (initialBatch.metrcBatchId || null)) payload.metrcBatchId = metrcBatchId.trim() || null
        if ((packageTag.trim() || null) !== (initialBatch.packageTag || null)) payload.packageTag = packageTag.trim() || null
        if ((notes.trim() || null) !== (initialBatch.notes || null)) payload.notes = notes.trim() || null
        const initialWorkerIds = initialBatch.assignments.map((a) => a.worker.id).sort().join(',')
        if ([...workerIds].sort().join(',') !== initialWorkerIds) payload.workerIds = workerIds
      }
      const res = await fetch(duplicate ? '/api/batches' : `/api/batches/${batch.id}`, {
        method: duplicate ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicate ? { ...fullPayload, recipeId: batch.recipe.id, sourceBatchId: batch.id } : payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save batch')
      emitBatchChanged(data.batch.id, duplicate ? 'duplicate' : 'edit')
      router.push(`/batches/${data.batch.id}${duplicate ? '/manage' : ''}`)
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Network error') }
    finally { setSaving(false) }
  }

  const refreshBatch = async () => {
    const res = await fetch(`/api/batches/${batch.id}`, { cache: 'no-store' })
    if (res.ok) { const data = await res.json(); setBatch(data.batch) }
  }

  const stepAction = async (step: Step, action: string) => {
    setError('')
    const res = await fetch(`/api/batches/${batch.id}/steps/${step.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'Failed to update step')
    await refreshBatch(); emitBatchChanged(batch.id, 'step-edit'); notify('Workflow updated')
  }

  const openStepEditor = (step: Step) => {
    setEditingStep(step.id)
    setStepDraft({ name: cleanStepName(step.name), type: step.type, target: step.targetQuantity?.toString() || '', unitLabel: step.unitLabel })
  }

  const saveStep = async (step: Step) => {
    const res = await fetch(`/api/batches/${batch.id}/steps/${step.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: stepDraft.name, type: stepDraft.type, targetQuantity: stepDraft.type === 'CHECK' ? 1 : stepDraft.target || null, unitLabel: stepDraft.unitLabel }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'Failed to update step')
    setEditingStep(null); await refreshBatch(); emitBatchChanged(batch.id, 'step-edit'); notify('Step saved')
  }

  const addStep = async () => {
    const res = await fetch(`/api/batches/${batch.id}/steps`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: stepDraft.name, type: stepDraft.type, targetQuantity: stepDraft.type === 'CHECK' ? 1 : stepDraft.target || null, unitLabel: stepDraft.unitLabel }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'Failed to add step')
    setAddingStep(false); setStepDraft({ name: '', type: 'COUNT', target: '', unitLabel: 'units' })
    await refreshBatch(); emitBatchChanged(batch.id, 'step-edit'); notify('Step added')
  }

  const lifecycle = async (status: string) => {
    const res = await fetch(`/api/batches/${batch.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'Failed to update batch')
    emitBatchChanged(batch.id, 'status'); router.push(`/batches/${batch.id}`); router.refresh()
  }

  const deleteBatch = async () => {
    const res = await fetch(`/api/batches/${batch.id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json().catch(() => ({})); return setError(data.error || 'Failed to delete batch') }
    emitBatchChanged(batch.id, 'delete'); router.push('/batches'); router.refresh()
  }

  const summaryTarget = openEnded ? 'Open-ended' : `${target || 0} ${batch.recipe.name}`
  return (
    <AppShell session={session}>
      <main className="mx-auto max-w-2xl px-4 py-5 pb-36">
        <div className="mb-5 flex items-center gap-3">
          <Link href={`/batches/${batch.id}`} className="bf-icon-btn" aria-label="Back to batch">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-foreground">{duplicate ? 'Review Duplicate' : 'Manage Batch'}</h1>
            <p className="truncate text-sm text-muted-foreground">{duplicate ? `Based on ${initialBatch.name}` : initialBatch.name}</p>
          </div>
        </div>

        {toast && <div className="fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">{toast}</div>}
        {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

        <div className="space-y-3">
          <Section title="Setup" summary={`${summaryTarget} · ${priority}`} defaultOpen>
            <div><label className={labelClass}>Batch name</label><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <label className={labelClass}>Target type</label>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setOpenEnded(false)} className={`bf-select-btn ${!openEnded ? 'bf-select-btn-active' : ''}`}>Fixed target</button><button type="button" onClick={() => setOpenEnded(true)} className={`bf-select-btn ${openEnded ? 'bf-select-btn-active' : ''}`}>Open-ended</button></div>
            </div>
            {!openEnded && <div><label className={labelClass}>Target quantity</label><input className={inputClass} type="number" inputMode="numeric" min="1" value={target} onChange={(e) => setTarget(e.target.value)} /></div>}
            <div><label className={labelClass}>Due date</label><input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><label className={labelClass}>Priority</label><div className="grid grid-cols-4 gap-2">{(['LOW','NORMAL','HIGH','URGENT'] as Priority[]).map((p) => <button key={p} type="button" onClick={() => setPriority(p)} className={`bf-select-btn px-1 text-xs ${priority === p ? 'bf-select-btn-active' : ''}`}>{p[0] + p.slice(1).toLowerCase()}</button>)}</div></div>
          </Section>

          <Section title="Team" summary={workerIds.length ? `${workerIds.length} assigned` : 'Open to the whole team'}>
            <p className="text-sm text-muted-foreground">No selection means any worker can access this batch.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{workers.map((worker) => { const selected = workerIds.includes(worker.id); return <button type="button" key={worker.id} onClick={() => setWorkerIds(selected ? workerIds.filter((id) => id !== worker.id) : [...workerIds, worker.id])} className={`bf-select-btn justify-start ${selected ? 'bf-select-btn-active' : ''}`}>{selected ? '✓ ' : ''}{worker.name}</button> })}</div>
          </Section>

          <Section title="Tracking & Notes" summary={strain || lotNumber || metrcBatchId || packageTag || notes ? 'Tracking information added' : 'No tracking information'}>
            <div><label className={labelClass}>Strain</label><input className={inputClass} value={strain} onChange={(e) => setStrain(e.target.value)} /></div>
            <div><label className={labelClass}>METRC Batch ID</label><input className={inputClass} value={metrcBatchId} onChange={(e) => setMetrcBatchId(e.target.value)} /></div>
            <div><label className={labelClass}>Lot number</label><input className={inputClass} value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} /></div>
            <div><label className={labelClass}>Package tag</label><input className={inputClass} value={packageTag} onChange={(e) => setPackageTag(e.target.value)} /></div>
            <div><label className={labelClass}>Team notes</label><textarea className={`${inputClass} min-h-[110px]`} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /><p className="mt-1 text-right text-xs text-muted-foreground">{notes.length}/2000</p></div>
          </Section>

          {!duplicate && batch.status === 'ACTIVE' && <Section title="Workflow" summary={`${batch.steps.filter((s) => !s.name.startsWith(SKIPPED_PREFIX)).length} active steps`}>
            <p className="text-sm text-muted-foreground">This changes only this batch. The recipe stays untouched.</p>
            <div className="space-y-2">{batch.steps.map((step, index) => <div key={step.id} className={`rounded-xl border p-3 ${step.name.startsWith(SKIPPED_PREFIX) ? 'border-amber-500/20 bg-amber-500/5 opacity-70' : 'border-border bg-muted/30'}`}>
              {editingStep === step.id ? <div className="space-y-2">
                <input className={inputClass} value={stepDraft.name} onChange={(e) => setStepDraft({ ...stepDraft, name: e.target.value })} placeholder="Step name" />
                <div className="grid grid-cols-2 gap-2"><select className={inputClass} value={stepDraft.type} onChange={(e) => setStepDraft({ ...stepDraft, type: e.target.value as 'COUNT' | 'CHECK' })}><option value="COUNT">Count</option><option value="CHECK">Done tap</option></select><input className={inputClass} value={stepDraft.unitLabel} onChange={(e) => setStepDraft({ ...stepDraft, unitLabel: e.target.value })} placeholder="Unit" /></div>
                {stepDraft.type === 'COUNT' && <input className={inputClass} type="number" inputMode="numeric" value={stepDraft.target} onChange={(e) => setStepDraft({ ...stepDraft, target: e.target.value })} placeholder="Open-ended target" />}
                <div className="flex gap-2"><button type="button" onClick={() => saveStep(step)} className="bf-btn bf-btn-primary flex-1">Save step</button><button type="button" onClick={() => setEditingStep(null)} className="bf-btn bf-btn-secondary">Cancel</button></div>
              </div> : <>
                <div className="flex items-start justify-between gap-2"><div><p className="font-medium text-foreground">{index + 1}. {cleanStepName(step.name)}</p><p className="text-xs text-muted-foreground">{step.type === 'CHECK' ? 'Done tap' : step.targetQuantity == null ? `Open count · ${step.unitLabel}` : `${step.targetQuantity} ${step.unitLabel}`}</p></div><button type="button" onClick={() => openStepEditor(step)} className="bf-btn bf-btn-ghost bf-btn-sm">Edit</button></div>
                <div className="mt-2 flex gap-2"><button type="button" disabled={index === 0} onClick={() => stepAction(step, 'move-up')} className="bf-icon-btn" aria-label="Move step up">↑</button><button type="button" disabled={index === batch.steps.length - 1} onClick={() => stepAction(step, 'move-down')} className="bf-icon-btn" aria-label="Move step down">↓</button><button type="button" onClick={() => stepAction(step, step.name.startsWith(SKIPPED_PREFIX) ? 'unskip' : 'skip')} className="bf-btn bf-btn-ghost bf-btn-sm ml-auto">{step.name.startsWith(SKIPPED_PREFIX) ? 'Restore' : 'Skip'}</button></div>
              </>}
            </div>)}</div>
            {addingStep ? <div className="space-y-2 rounded-xl border border-border p-3"><input className={inputClass} value={stepDraft.name} onChange={(e) => setStepDraft({ ...stepDraft, name: e.target.value })} placeholder="New step name" /><div className="grid grid-cols-2 gap-2"><select className={inputClass} value={stepDraft.type} onChange={(e) => setStepDraft({ ...stepDraft, type: e.target.value as 'COUNT' | 'CHECK' })}><option value="COUNT">Count</option><option value="CHECK">Done tap</option></select><input className={inputClass} value={stepDraft.unitLabel} onChange={(e) => setStepDraft({ ...stepDraft, unitLabel: e.target.value })} placeholder="Unit" /></div>{stepDraft.type === 'COUNT' && <input className={inputClass} type="number" inputMode="numeric" value={stepDraft.target} onChange={(e) => setStepDraft({ ...stepDraft, target: e.target.value })} placeholder="Target (blank = open)" />}<div className="flex gap-2"><button type="button" onClick={addStep} className="bf-btn bf-btn-primary flex-1">Add step</button><button type="button" onClick={() => setAddingStep(false)} className="bf-btn bf-btn-secondary">Cancel</button></div></div> : <button type="button" onClick={() => { setAddingStep(true); setStepDraft({ name: '', type: 'COUNT', target: '', unitLabel: 'units' }) }} className="bf-btn bf-btn-secondary w-full">+ Add one-off step</button>}
          </Section>}

          {duplicate && <Section title="Workflow" summary={`${batch.steps.filter((s) => !s.name.startsWith(SKIPPED_PREFIX)).length} steps will be copied`}>
            <p className="text-sm text-muted-foreground">The current order, custom names, skipped steps, units, and targets will be copied. Production progress starts at zero.</p>
            <div className="space-y-2">{batch.steps.map((step, index) => <div key={step.id} className={`rounded-xl border border-border p-3 ${step.name.startsWith(SKIPPED_PREFIX) ? 'opacity-50' : ''}`}><p className="font-medium text-foreground">{index + 1}. {cleanStepName(step.name)}{step.name.startsWith(SKIPPED_PREFIX) ? ' · skipped' : ''}</p><p className="text-xs text-muted-foreground">{step.type === 'CHECK' ? 'Done tap' : step.targetQuantity == null ? `Open count · ${step.unitLabel}` : `${step.targetQuantity} ${step.unitLabel}`}</p></div>)}</div>
          </Section>}

          {!duplicate && <Section title="Lifecycle" summary={batch.status === 'ACTIVE' ? 'Active production batch' : batch.status}>
            <Link href={`/batches/${batch.id}/manage?duplicate=1`} className="bf-btn bf-btn-secondary w-full">Duplicate & review</Link>
            {batch.status === 'ACTIVE' && <button type="button" onClick={() => setConfirm({ title: 'Mark batch complete?', message: 'Production logging will stop. Owners can reopen it later.', label: 'Mark Complete', action: () => lifecycle('COMPLETED') })} className="bf-btn bf-btn-success w-full">Mark Complete</button>}
            {batch.status !== 'ACTIVE' && session.role === 'OWNER' && <button type="button" onClick={() => setConfirm({ title: 'Reopen batch?', message: 'The team will be able to log production again.', label: 'Reopen', action: () => lifecycle('ACTIVE') })} className="bf-btn bf-btn-secondary w-full">Reopen Batch</button>}
            {batch.status === 'ACTIVE' && session.role === 'OWNER' && <button type="button" onClick={() => setConfirm({ title: 'Cancel batch?', message: 'This stops production but keeps the batch record.', label: 'Cancel Batch', action: () => lifecycle('CANCELLED') })} className="bf-btn bf-btn-soft-danger w-full">Cancel Batch</button>}
            {batch.status === 'CANCELLED' && session.role === 'OWNER' && <button type="button" onClick={() => setConfirm({ title: 'Delete batch permanently?', message: 'This removes the cancelled batch and its production history. This cannot be undone.', label: 'Delete Permanently', action: deleteBatch })} className="bf-btn bf-btn-soft-danger w-full">Delete Permanently</button>}
          </Section>}
        </div>

        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2">
          <button type="button" onClick={save} disabled={saving || (!dirty && !duplicate)} className="bf-btn bf-btn-primary min-h-[52px] w-full">{saving ? 'Saving…' : duplicate ? 'Create Duplicate' : dirty ? 'Save Changes' : 'All Changes Saved'}</button>
        </div>
      </main>
      <ConfirmModal open={!!confirm} title={confirm?.title || ''} message={confirm?.message} confirmLabel={confirm?.label} confirmStyle="danger" onCancel={() => setConfirm(null)} onConfirm={() => { const action = confirm?.action; setConfirm(null); action?.() }} />
    </AppShell>
  )
}
