'use client'

import { useState } from 'react'
import { translateUi } from '@/lib/uiLocale'

type HistoryRow = {
  id: string
  action: 'create' | 'edit' | 'delete' | string
  oldQuantity: number | null
  newQuantity: number | null
  createdAt: string
  worker: { id: string; name: string } | null
}

// Shows who added, changed or removed each weigh-in on a weight step, and when.
export default function WeighInHistory({
  batchId,
  stepId,
  unitLabel,
  language,
  formatTimestamp,
}: {
  batchId: string
  stepId: string
  unitLabel: string
  language?: string
  formatTimestamp: (date: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batchId}/steps/${stepId}/history`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRows(data.history || [])
    } catch {
      setError(translateUi('Could not load the change history', language))
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const fmt = (value: number | null) => `${(value ?? 0).toLocaleString()} ${unitLabel}`
  const describe = (row: HistoryRow) => {
    const who = row.worker?.name || translateUi('Someone', language)
    if (row.action === 'create') return `${who} ${translateUi('added', language)} ${fmt(row.newQuantity)}`
    if (row.action === 'delete') return `${who} ${translateUi('removed', language)} ${fmt(row.oldQuantity)}`
    if (row.oldQuantity === row.newQuantity) return `${who} ${translateUi('changed the note', language)}`
    return `${who} ${translateUi('changed', language)} ${fmt(row.oldQuantity)} → ${fmt(row.newQuantity)}`
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="bf-btn bf-btn-ghost bf-btn-sm h-auto min-h-[32px] px-2 py-1 text-xs"
      >
        {open ? translateUi('Hide change history', language) : translateUi('Change history', language)}
      </button>
      {open && (
        <div className="mt-1 space-y-1 rounded-lg bg-muted/35 px-2 py-2 text-xs">
          {loading && <p className="text-muted-foreground">{translateUi('Loading…', language)}</p>}
          {error && <p role="alert" className="text-red-500 dark:text-red-400">{error}</p>}
          {!loading && !error && rows?.length === 0 && (
            <p className="text-muted-foreground">{translateUi('No changes recorded yet', language)}</p>
          )}
          {!loading && rows?.map(row => (
            <p key={row.id} className="flex items-baseline justify-between gap-2 text-foreground">
              <span className="min-w-0 tabular-nums">{describe(row)}</span>
              <span className="shrink-0 text-muted-foreground">{formatTimestamp(row.createdAt)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
