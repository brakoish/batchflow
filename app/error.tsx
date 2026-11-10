'use client'

import { useEffect } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-6 py-12">
      <div role="alert" className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <ExclamationTriangleIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">This screen didn&apos;t load. Try again, or reload the app.</p>
        <button type="button" onClick={() => reset()} className="bf-btn bf-btn-primary bf-btn-full mt-5">
          Try again
        </button>
      </div>
    </main>
  )
}
