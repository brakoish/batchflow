'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StockCountButton({ recipeId, productId, productName, baseUnit, currentQuantity }: {
  recipeId: string
  productId: string | null
  productName: string
  baseUnit: string
  currentQuantity: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(String(currentQuantity))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (countedQuantity = Number(quantity)) => {
    if (!Number.isInteger(countedQuantity) || countedQuantity < 0) {
      setError('Enter a whole number of 0 or more')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/stock/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, productId, countedQuantity, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Unable to save count')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setQuantity(String(currentQuantity)); setNote(''); setError(''); setOpen(true) }} className="bf-btn bf-btn-secondary bf-btn-sm mt-3 w-full">
        Count Stock
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">Count {productName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter the physical quantity on hand. This records a correction without deleting batch history.</p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{baseUnit} on hand</label>
            <input autoFocus type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 min-h-[52px] w-full rounded-xl border border-input bg-muted px-3 text-xl font-bold text-foreground" />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note (optional)</label>
            <input value={note} onChange={(event) => setNote(event.target.value.slice(0, 300))} placeholder="Physical count, old stock cleanup…" className="mt-1 min-h-[48px] w-full rounded-xl border border-input bg-muted px-3 text-base text-foreground" />
            {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => save()} className="bf-btn bf-btn-primary">{saving ? 'Saving…' : 'Save Count'}</button>
              <button type="button" disabled={saving} onClick={() => setOpen(false)} className="bf-btn bf-btn-secondary">Cancel</button>
            </div>
            <button type="button" disabled={saving} onClick={() => save(0)} className="bf-btn bf-btn-danger mt-2 w-full">Clear to 0</button>
          </div>
        </div>
      )}
    </>
  )
}
