'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { haptic } from '@/lib/haptic'

export default function NewOrgPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
    if (status === 'authenticated' && session?.user?.organizationId) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        haptic('heavy')
        setError(data.error || 'Failed to create organization')
        return
      }

      haptic('medium')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      haptic('heavy')
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mx-auto mb-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="6"/>
            <rect x="12" y="56" width="32" height="32" rx="6"/>
            <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
          </svg>
          <h1 className="text-2xl font-semibold text-foreground">Create Organization</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Set up your facility to start managing batches
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
              Organization Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Green Leaf Processing"
              className="w-full px-4 py-3 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-foreground"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-lg bg-foreground text-background font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          You'll be the owner of this organization and can invite workers later.
        </p>
      </div>
    </div>
  )
}
