'use client'

import { useState } from 'react'
import { ArchiveBoxIcon, ArrowUturnLeftIcon, PlusIcon } from '@heroicons/react/24/outline'

type Product = { id: string; name: string; brand: string | null; archivedAt: string | null; recipe: { name: string } }
type Brand = { id: string; name: string }

export default function ProductsManager({ initialProducts, initialBrands }: { initialProducts: Product[]; initialBrands: Brand[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [brands, setBrands] = useState(initialBrands)
  const [brandName, setBrandName] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const addBrand = async () => {
    const name = brandName.trim()
    if (!name) return
    setBusy('brand'); setError('')
    const response = await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setBrands((current) => [...current.filter((brand) => brand.id !== data.brand.id), data.brand].sort((a, b) => a.name.localeCompare(b.name)))
      setBrandName('')
    } else setError(data.error || 'Unable to add brand')
    setBusy('')
  }

  const toggleArchive = async (product: Product) => {
    setBusy(product.id); setError('')
    const archived = !product.archivedAt
    const response = await fetch(`/api/products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }) })
    const data = await response.json().catch(() => ({}))
    if (response.ok) setProducts((current) => current.map((item) => item.id === product.id ? { ...item, archivedAt: data.product.archivedAt } : item))
    else setError(data.error || 'Unable to update product')
    setBusy('')
  }

  const visible = products.filter((product) => showArchived ? Boolean(product.archivedAt) : !product.archivedAt)
  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold text-foreground">Products & brands</h1><p className="mt-1 text-sm text-muted-foreground">Saved brands are available anywhere you add a finished product.</p></div>
    {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>}
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Saved brands</h2>
      <div className="mt-3 flex flex-wrap gap-2">{brands.map((brand) => <span key={brand.id} className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm">{brand.name}</span>)}</div>
      <div className="mt-3 flex gap-2"><input value={brandName} onChange={(event) => setBrandName(event.target.value.slice(0, 100))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBrand() } }} placeholder="New brand name" className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base" /><button onClick={addBrand} disabled={busy === 'brand' || !brandName.trim()} className="bf-btn bf-btn-success"><PlusIcon className="h-4 w-4" /> Add</button></div>
    </section>
    <section>
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-foreground">Finished products</h2><p className="text-xs text-muted-foreground">Archiving hides a product from future batches. History and stock records stay intact.</p></div><button onClick={() => setShowArchived((value) => !value)} className="bf-btn bf-btn-secondary bf-btn-sm">{showArchived ? 'Active' : 'Archived'}</button></div>
      <div className="mt-3 space-y-2">{visible.map((product) => <div key={product.id} className="flex min-h-[68px] items-center gap-3 rounded-xl border border-border bg-card p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="truncate text-xs text-muted-foreground">{product.brand || 'Unassigned'} · {product.recipe.name}</p></div><button onClick={() => toggleArchive(product)} disabled={busy === product.id} className="bf-icon-btn" aria-label={product.archivedAt ? `Restore ${product.name}` : `Archive ${product.name}`}>{product.archivedAt ? <ArrowUturnLeftIcon className="h-5 w-5" /> : <ArchiveBoxIcon className="h-5 w-5" />}</button></div>)}{visible.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No {showArchived ? 'archived' : 'active'} products.</p>}</div>
    </section>
  </div>
}
