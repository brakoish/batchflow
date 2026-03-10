'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { haptic } from '@/lib/haptic'

type Worker = {
  id: string
  name: string
  pin: string
  role: string
}

export default function WorkerManager({ workers }: { workers: Worker[] }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<'WORKER' | 'OWNER'>('WORKER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [editPin, setEditPin] = useState('')
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

  return (
    <div className="space-y-4">
      {/* Add Worker */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Add Worker</h2>
        <div className="bg-card border border-border p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Worker name"
            className="w-full px-3 py-2 bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            disabled={loading}
          />

          <div className="flex gap-2">
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="PIN (4 digits)"
              className="flex-1 px-3 py-2 bg-background border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              disabled={loading}
              maxLength={4}
            />
            <button
              onClick={generatePin}
              disabled={loading}
              className="px-3 py-2 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            >
              Random
            </button>
          </div>

          <div className="flex gap-2">
            {(['WORKER', 'OWNER'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                disabled={loading}
                className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                  role === r
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-foreground border-border hover:border-foreground'
                }`}
              >
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-2 bg-destructive/10 border border-destructive">
              <p className="text-destructive text-xs">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-2 bg-success/10 border border-success">
              <p className="text-success text-xs font-medium">{success}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {loading ? 'Creating...' : 'Create Worker'}
          </button>
          <p className="text-xs text-muted-foreground text-center">Leave PIN blank for auto-generation</p>
        </div>
      </div>

      {/* Edit PIN Modal */}
      {editingWorker && (
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Set PIN for {editingWorker.name}</h3>
            <button
              onClick={() => { setEditingWorker(null); setEditPin(''); setError('') }}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={editPin}
            onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="New PIN (4 digits)"
            className="w-full px-3 py-2 bg-background border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            maxLength={4}
            autoFocus
          />
          {error && (
            <div className="p-2 bg-destructive/10 border border-destructive">
              <p className="text-destructive text-xs">{error}</p>
            </div>
          )}
          <button
            onClick={handleUpdatePin}
            disabled={loading || editPin.length !== 4}
            className="w-full py-2 bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {loading ? 'Updating...' : 'Update PIN'}
          </button>
        </div>
      )}

      {/* Worker List with Edit */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Team</h2>
        <div className="space-y-2">
          {workers.map((worker) => (
            <div key={worker.id} className="bg-card border border-border p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{worker.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">PIN: {worker.pin}</span>
                  <span className={`text-xs px-2 py-0.5 border ${
                    worker.role === 'OWNER'
                      ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                      : 'bg-primary/10 text-primary border-primary/30'
                  }`}>
                    {worker.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setEditingWorker(worker); setEditPin(''); setError('') }}
                className="px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                Set PIN
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}