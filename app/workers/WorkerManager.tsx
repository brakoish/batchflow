'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/haptic'
import ConfirmModal from '@/app/components/ConfirmModal'

type Worker = {
  id: string
  name: string
  pin: string
  role: string
}
type ConfirmAction = {
  title: string
  message?: string
  confirmLabel: string
  confirmStyle?: 'danger' | 'primary'
  onConfirm: () => void
}

export default function WorkerManager({ workers }: { workers: Worker[] }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<'WORKER' | 'SUPERVISOR' | 'OWNER'>('WORKER')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [editPin, setEditPin] = useState('')
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'WORKER' | 'SUPERVISOR' | 'OWNER'>('WORKER')
  const [showEditModal, setShowEditModal] = useState(false)
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const router = useRouter()

  const generatePin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString()
    setPin(randomPin)
    haptic('light')
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name required'); return }
    if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      setError('PIN must be 4 digits'); return
    }
    setLoading(true); setError(''); setSuccess('')

    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, pin: pin || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(`Created: ${data.worker.name} / PIN: ${data.worker.pin}`)
      setName(''); setPin(''); setRole('WORKER')
      setShowAddForm(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 5000)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const handleUpdateWorker = async () => {
    if (!editingWorker) return
    if (!editName.trim()) { setError('Name required'); return }
    setLoading(true); setError('')

    try {
      const res = await fetch(`/api/workers/${editingWorker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, role: editRole }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(`Updated ${data.worker.name}`)
      setEditingWorker(null)
      setShowEditModal(false)
      router.refresh()
      setTimeout(() => setSuccess(''), 5000)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const handleUpdatePin = async () => {
    if (!editingWorker) return
    if (!editPin || editPin.length !== 4 || !/^\d{4}$/.test(editPin)) {
      setError('PIN must be 4 digits'); return
    }
    setLoading(true); setError('')

    try {
      const res = await fetch(`/api/workers/${editingWorker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: editPin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(`Updated PIN for ${editingWorker.name}`)
      setEditingWorker(null)
      setEditPin('')
      router.refresh()
      setTimeout(() => setSuccess(''), 5000)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const handleDeleteWorker = async (worker: Worker) => {
    setConfirmAction({
      title: `Delete ${worker.name}?`,
      message: 'This removes the worker from the team and cannot be undone.',
      confirmLabel: 'Delete Worker',
      confirmStyle: 'danger',
      onConfirm: () => performDeleteWorker(worker),
    })
  }

  const performDeleteWorker = async (worker: Worker) => {
    setConfirmAction(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/workers/${worker.id}`, { method: 'DELETE' })
      if (!res.ok) { 
        const data = await res.json()
        setError(data.error || 'Failed to delete')
        return
      }
      setSuccess(`Deleted ${worker.name}`)
      router.refresh()
      setTimeout(() => setSuccess(''), 5000)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  const openEditModal = (worker: Worker) => {
    setEditingWorker(worker)
    setEditName(worker.name)
    setEditRole(worker.role as 'WORKER' | 'SUPERVISOR' | 'OWNER')
    setEditPin('')
    setError('')
    setShowEditModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Team</h2>
          <p className="text-sm text-muted-foreground">{workers.length} worker{workers.length === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bf-btn bf-btn-primary"
        >
          {showAddForm ? 'Close' : '+ Worker'}
        </button>
      </div>

      {/* Add Worker */}
      {showAddForm && (
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-medium text-foreground">Add Worker</h2>
        
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Worker name"
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          disabled={loading}
        />

        <div className="flex gap-2">
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="PIN (4 digits)"
            className="flex-1 px-3 py-2.5 bg-background border border-border rounded-md text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            disabled={loading}
            maxLength={4}
          />
          <button
            onClick={generatePin}
            disabled={loading}
            className="bf-btn bf-btn-secondary"
          >
            Random
          </button>
        </div>

        <div className="flex gap-2">
          {(['WORKER', 'SUPERVISOR', 'OWNER'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              disabled={loading}
              className={`bf-select-btn flex-1 ${
                role === r
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100'
                  : ''
              }`}
            >
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-md bg-destructive-subtle border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-3 rounded-md bg-success-subtle border border-success/20">
            <p className="text-success text-sm font-medium">{success}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bf-btn bf-btn-primary bf-btn-full"
        >
          {loading ? 'Creating...' : 'Create Worker'}
        </button>
        <p className="text-xs text-muted-foreground text-center">Leave PIN blank for auto-generation</p>
      </div>
      )}

      {/* Edit Worker Modal */}
      {showEditModal && editingWorker && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Edit Worker</h3>
            <button
              onClick={() => { setShowEditModal(false); setEditingWorker(null); setError('') }}
              className="bf-icon-btn"
            >
              ✕
            </button>
          </div>
          
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Worker name"
            className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />

          <div className="flex gap-2">
            {(['WORKER', 'SUPERVISOR', 'OWNER'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setEditRole(r)}
                className={`bf-select-btn flex-1 ${
                  editRole === r
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100'
                    : ''
                }`}
              >
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-border">
            <label className="text-xs text-muted-foreground block mb-2">Change PIN</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editPin}
                onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="New PIN (4 digits)"
                className="flex-1 px-3 py-2.5 bg-background border border-border rounded-md text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                maxLength={4}
              />
              <button
                onClick={handleUpdatePin}
                disabled={loading || editPin.length !== 4}
                className="bf-btn bf-btn-primary"
              >
                Set PIN
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive-subtle border border-destructive/20">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleUpdateWorker}
            disabled={loading || !editName.trim()}
            className="bf-btn bf-btn-primary bf-btn-full"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Worker List */}
      <div className="space-y-3">
        {workers.map((worker) => (
          <div key={worker.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{worker.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    haptic('light')
                    setRevealedPins(prev => {
                      const next = new Set(prev)
                      if (next.has(worker.id)) next.delete(worker.id)
                      else next.add(worker.id)
                      return next
                    })
                  }}
                  className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
                >
                  PIN: {revealedPins.has(worker.id) ? worker.pin : '••••'}
                </button>
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  worker.role === 'OWNER'
                    ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                    : worker.role === 'SUPERVISOR'
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}>
                  {worker.role}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(worker)}
                className="bf-btn bf-btn-secondary"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteWorker(worker)}
                className="bf-btn bf-btn-soft-danger"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

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
