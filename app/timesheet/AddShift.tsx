'use client'
import { useState, useRef, useCallback } from 'react'
import { useDialogFocus } from '@/app/components/useDialogFocus'

export default function AddShift({ workers, timezone, onAdded }: { workers: { id: string; name: string }[]; timezone: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDialogFocus(ref, open, close, busy)
  return <>
    <div className="flex items-center gap-3"><button className="bf-btn bf-btn-primary" onClick={() => { setError(''); setSuccess(''); setOpen(true) }}>Add Shift</button>{success && <p role="status">{success}</p>}</div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="add-shift-title" className="w-full max-w-md rounded-2xl bg-card p-5 max-h-[90dvh] overflow-y-auto">
      <h2 id="add-shift-title" className="text-lg font-semibold">Add missed shift</h2>
      <p className="text-sm text-muted-foreground">Enter dates and times in {timezone}. For overnight shifts, choose the next day for clock-out.</p>
      <form className="mt-4 space-y-4" onSubmit={async event => {
        event.preventDefault()
        if (busy) return
        const data = new FormData(event.currentTarget)
        setBusy(true); setError('')
        try {
          const response = await fetch('/api/shifts/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Unable to add shift')
          setOpen(false); setSuccess('Shift added. Totals refresh for the selected filters.'); onAdded()
        } catch (error) { setError(error instanceof Error ? error.message : 'Connection error. Try again.') } finally { setBusy(false) }
      }}>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block">Worker<select name="workerId" required defaultValue="" className="block w-full"><option value="" disabled>Select worker</option>{workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
          <label className="block">Clock-in<input className="block w-full" name="startLocal" type="datetime-local" required /></label>
          <label className="block">Clock-out<input className="block w-full" name="endLocal" type="datetime-local" required /></label>
          <label className="block">Note (optional)<textarea className="block w-full" name="note" maxLength={1000} /></label>
        </fieldset>
        {error && <p role="alert" className="text-red-500">{error}</p>}
        <div className="flex gap-2"><button type="button" className="bf-btn bf-btn-secondary" disabled={busy} onClick={close}>Cancel</button><button className="bf-btn bf-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save shift'}</button></div>
      </form>
    </div></div>}
  </>
}
