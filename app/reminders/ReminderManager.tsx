'use client'

import { useState } from 'react'
import ConfirmModal from '@/app/components/ConfirmModal'
import { haptic } from '@/lib/haptic'

type Assignment = { workerId: string; enabled: boolean }
type Reminder = { id: string; message: string; emoji: string; intervalMinutes: number; assignments: Assignment[] }
type Worker = { id: string; name: string; role: string }

const emojiChoices = ['🧼', '🧤', '💧', '🧹', '🧍', '🔔']

function frequencyLabel(minutes: number) {
  if (minutes < 60) return `Every ${minutes} min`
  if (minutes % 60 === 0) return `Every ${minutes / 60} hr${minutes === 60 ? '' : 's'}`
  return `Every ${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}

export default function ReminderManager({ initialReminders, workers }: { initialReminders: Reminder[]; workers: Worker[] }) {
  const [reminders, setReminders] = useState(initialReminders)
  const [message, setMessage] = useState('')
  const [emoji, setEmoji] = useState('🧼')
  const [intervalMinutes, setIntervalMinutes] = useState('60')
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const saveReminder = async () => {
    setSaving(true); setError('')
    try {
      const target = editing ? `/api/reminders/${editing.id}` : '/api/reminders'
      const res = await fetch(target, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, emoji, intervalMinutes: Number(intervalMinutes) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Unable to save reminder'); return }
      setReminders((current) => editing
        ? current.map((item) => item.id === editing.id ? data.reminder : item)
        : [...current, data.reminder])
      setMessage(''); setEmoji('🧼'); setIntervalMinutes('60'); setEditing(null)
      haptic('medium')
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  const beginEdit = (reminder: Reminder) => {
    setEditing(reminder); setMessage(reminder.message); setEmoji(reminder.emoji)
    setIntervalMinutes(String(reminder.intervalMinutes)); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleWorker = async (reminderId: string, workerId: string, enabled: boolean) => {
    setError('')
    setReminders((current) => current.map((reminder) => reminder.id === reminderId
      ? { ...reminder, assignments: [...reminder.assignments.filter((a) => a.workerId !== workerId), { workerId, enabled }] }
      : reminder))
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerId, enabled }),
      })
      if (!res.ok) throw new Error()
      haptic('light')
    } catch {
      fetch('/api/reminders', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => { if (data.reminders) setReminders(data.reminders) })
        .catch(() => {})
      setError('Could not update employee assignment')
    }
  }

  const removeReminder = async () => {
    if (!deleteId) return
    const id = deleteId; setDeleteId(null); setSaving(true); setError('')
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReminders((current) => current.filter((reminder) => reminder.id !== id))
      if (editing?.id === id) { setEditing(null); setMessage('') }
    } catch { setError('Could not delete reminder') }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-5 space-y-5">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="font-semibold text-foreground">{editing ? 'Edit reminder' : 'New reminder'}</h2>
          <p className="text-xs text-muted-foreground">Employees receive the first reminder after this much time on shift.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Message</label>
          <input value={message} onChange={(e) => setMessage(e.target.value.slice(0, 120))} placeholder="Wash hands" className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Icon</label>
          <div className="flex flex-wrap gap-2">
            {emojiChoices.map((choice) => <button key={choice} type="button" onClick={() => setEmoji(choice)} className={`bf-select-btn h-12 w-12 p-0 text-xl ${emoji === choice ? 'border-emerald-500 bg-emerald-500/10' : ''}`}>{choice}</button>)}
            <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 16))} aria-label="Custom emoji" className="h-12 w-16 rounded-xl border border-input bg-background px-2 text-center text-xl" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">How often</label>
          <select value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground">
            <option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option><option value="60">Every hour</option><option value="120">Every 2 hours</option><option value="240">Every 4 hours</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={saveReminder} disabled={saving || !message.trim()} className="bf-btn bf-btn-primary min-h-[48px] flex-1">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Reminder'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setMessage(''); setEmoji('🧼'); setIntervalMinutes('60') }} className="bf-btn bf-btn-secondary">Cancel</button>}
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="font-semibold text-foreground">Reminders</h2><p className="text-xs text-muted-foreground">Turn each reminder on for the employees who should receive it.</p></div>
        {reminders.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No reminders yet</div>}
        {reminders.map((reminder) => (
          <div key={reminder.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">{reminder.emoji}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-foreground">{reminder.message}</p><p className="text-xs text-muted-foreground">{frequencyLabel(reminder.intervalMinutes)} while clocked in</p></div>
              <button type="button" onClick={() => beginEdit(reminder)} className="bf-btn bf-btn-ghost bf-btn-sm">Edit</button>
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              {workers.map((worker) => {
                const enabled = reminder.assignments.some((a) => a.workerId === worker.id && a.enabled)
                return <button key={worker.id} type="button" role="switch" aria-checked={enabled} onClick={() => toggleWorker(reminder.id, worker.id, !enabled)} className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-2 text-left hover:bg-muted/50"><span><span className="block text-sm font-medium text-foreground">{worker.name}</span><span className="block text-[11px] capitalize text-muted-foreground">{worker.role.toLowerCase()}</span></span><span className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-muted'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} /></span></button>
              })}
              {workers.length === 0 && <p className="py-2 text-sm text-muted-foreground">Add employees before assigning reminders.</p>}
            </div>
            <button type="button" onClick={() => setDeleteId(reminder.id)} className="bf-btn bf-btn-ghost bf-btn-sm mt-3 text-red-500">Delete reminder</button>
          </div>
        ))}
      </section>
      <ConfirmModal open={!!deleteId} title="Delete reminder?" message="This turns it off for every assigned employee." confirmLabel="Delete Reminder" confirmStyle="danger" onCancel={() => setDeleteId(null)} onConfirm={removeReminder} />
    </div>
  )
}
