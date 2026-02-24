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
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          role,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create worker')
        return
      }

      setSuccess(`Worker created! PIN: ${data.worker.pin}`)
      setName('')
      setRole('WORKER')
      router.refresh()

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-6">Add New Worker</h2>

      {/* Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Worker Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Maria"
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
      </div>

      {/* Role */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-3">
          Role *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRole('WORKER')}
            disabled={loading}
            className={`py-3 px-4 rounded-xl border-2 font-semibold transition-colors ${
              role === 'WORKER'
                ? 'border-green-500 bg-green-900/20 text-white'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            Worker
          </button>
          <button
            onClick={() => setRole('OWNER')}
            disabled={loading}
            className={`py-3 px-4 rounded-xl border-2 font-semibold transition-colors ${
              role === 'OWNER'
                ? 'border-purple-500 bg-purple-900/20 text-white'
                : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            Owner
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Workers can log progress. Owners can manage recipes, batches, and
          workers.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-800">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-800">
          <p className="text-green-400 text-sm font-semibold">{success}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold text-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Worker'}
      </button>

      <p className="text-xs text-zinc-500 text-center mt-4">
        A unique 4-digit PIN will be automatically generated
      </p>
    </div>
  )
}
