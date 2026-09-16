'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type PickableProduct = {
  id: string
  name: string
  brand: string | null
  unitsPerCase: number | null
}

export default function ProductPicker({ products, value, baseUnit, onChange, disabled = false }: {
  products: PickableProduct[]
  value: string
  baseUnit: string
  onChange: (product: PickableProduct) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = products.find((product) => product.id === value)

  const groups = useMemo(() => {
    const filtered = products.filter((product) => `${product.brand || ''} ${product.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    const byBrand = new Map<string, PickableProduct[]>()
    for (const product of filtered) {
      const brand = product.brand?.trim() || 'Unassigned brand'
      byBrand.set(brand, [...(byBrand.get(brand) || []), product])
    }
    return Array.from(byBrand.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, items]) => ({ brand, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
  }, [products, query])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected ? `Finished product: ${selected.name}` : 'Select a finished product'}
        onClick={() => { if (open) setQuery(''); setOpen((current) => !current) }}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-input bg-muted px-3 py-2.5 text-left text-base text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className={`block truncate ${selected ? '' : 'text-muted-foreground'}`}>{selected?.name || 'Select a finished product'}</span>
          {selected && <span className="block truncate text-xs text-muted-foreground">{selected.brand || 'Unassigned brand'}{selected.unitsPerCase ? ` · ${selected.unitsPerCase} ${baseUnit.toLowerCase()} per case` : ''}</span>}
        </span>
        <span className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); setQuery('') } }}
              placeholder="Search items or brands"
              aria-label="Search finished products"
              className="min-h-[44px] w-full rounded-lg border border-input bg-muted px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div role="listbox" aria-label="Finished products" className="max-h-72 overflow-y-auto p-2">
            {groups.map(({ brand, items }) => (
              <div key={brand} className="mb-2 last:mb-0">
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{brand}</p>
                {items.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    aria-selected={product.id === value}
                    onClick={() => { onChange(product); setOpen(false); setQuery('') }}
                    className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${product.id === value ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-foreground hover:bg-muted'}`}
                  >
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{product.name}</span>{product.unitsPerCase && <span className="block text-[11px] text-muted-foreground">{product.unitsPerCase} {baseUnit.toLowerCase()} per case</span>}</span>
                    {product.id === value && <span aria-hidden="true" className="shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="px-3 py-5 text-center text-sm text-muted-foreground">No matching items</p>}
          </div>
        </div>
      )}
    </div>
  )
}
