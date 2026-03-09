'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WorkerManager() {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'WORKER' | 'OWNER'>('WORKER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name required'); return }
    setLoading(true); setError(''); setSuccess('')

    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(`PIN: ${data.worker.pin}`)
      setName(''); setRole('WORKER')
      router.refresh()
      setTimeout(() => setSuccess(''), 5000)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Add Worker</h2>
      <div className="rounded-xl border border bg-card p-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Worker name"
          className="w-full px-3.5 py-2.5 rounded-lg bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-3"
          disabled={loading}
        />

        <div className="flex gap-2 mb-4">
          {(['WORKER', 'OWNER'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                role === r
                  ? r === 'OWNER'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-input text-foreground hover:border-input'
              }`}
            >
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">{success}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
        >
          {loading ? 'Creating...' : 'Create Worker'}
        </button>
        <p className="text-[10px] text-muted-foreground/70 text-center mt-2">A unique 4-digit PIN will be generated</p>
      </div>
    </div>
  )
}
