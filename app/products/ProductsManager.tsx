'use client'

import { useState } from 'react'
import { ArchiveBoxIcon, ArrowUturnLeftIcon, CheckIcon, PencilIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

type Variation = { id: string; name: string; archivedAt: string | null }
type Product = { id: string; name: string; brand: string | null; archivedAt: string | null; recipe: { name: string; category: string }; variations: Variation[] }
type Brand = { id: string; name: string }

const categoryLabels: Record<string, string> = {
  FLOWER: 'Flower', PRE_ROLL: 'Pre-roll', PRE_ROLL_PACK: 'Pre-roll pack', VAPES: 'Vapes', EDIBLES: 'Edibles', OTHER: 'Other',
}

export default function ProductsManager({ initialProducts, initialBrands }: { initialProducts: Product[]; initialBrands: Brand[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [brands, setBrands] = useState(initialBrands)
  const [brandName, setBrandName] = useState('')
  const [variationNames, setVariationNames] = useState<Record<string, string>>({})
  const [showArchived, setShowArchived] = useState(false)
  const [showArchivedVariations, setShowArchivedVariations] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
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
    const response = await fetch(`/api/products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !product.archivedAt }) })
    const data = await response.json().catch(() => ({}))
    if (response.ok) setProducts((current) => current.map((item) => item.id === product.id ? { ...item, archivedAt: data.product.archivedAt } : item))
    else setError(data.error || 'Unable to update product')
    setBusy('')
  }

  const renameProduct = async (product: Product) => {
    const name = editingName.trim()
    if (!name || name === product.name) { setEditingId(''); return }
    setBusy(product.id); setError('')
    const response = await fetch(`/api/products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, name: data.product.name } : item))
      setEditingId(''); setEditingName('')
    } else setError(data.error || 'Unable to rename product')
    setBusy('')
  }

  const addVariation = async (product: Product) => {
    const name = (variationNames[product.id] || '').trim()
    if (!name) return
    setBusy(`add-${product.id}`); setError('')
    const response = await fetch(`/api/products/${product.id}/variations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, variations: [...item.variations.filter((variation) => variation.id !== data.variation.id), data.variation].sort((a, b) => a.name.localeCompare(b.name)) } : item))
      setVariationNames((current) => ({ ...current, [product.id]: '' }))
    } else setError(data.error || 'Unable to add variation')
    setBusy('')
  }

  const toggleVariationArchive = async (product: Product, variation: Variation) => {
    setBusy(`variation-${variation.id}`); setError('')
    const response = await fetch(`/api/products/${product.id}/variations/${variation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !variation.archivedAt }) })
    const data = await response.json().catch(() => ({}))
    if (response.ok) setProducts((current) => current.map((item) => item.id === product.id ? { ...item, variations: item.variations.map((value) => value.id === variation.id ? data.variation : value) } : item))
    else setError(data.error || 'Unable to update variation')
    setBusy('')
  }

  const visible = products.filter((product) => showArchived ? Boolean(product.archivedAt) : !product.archivedAt)
  const brandGroups = [...new Set(visible.map((product) => product.brand || 'Unassigned'))].sort((a, b) => a.localeCompare(b))
  const activeProductCount = products.filter((product) => !product.archivedAt).length
  const activeVariationCount = products.filter((product) => !product.archivedAt).reduce((count, product) => count + product.variations.filter((variation) => !variation.archivedAt).length, 0)

  return <div className="space-y-5">
    <div>
      <h1 className="text-xl font-bold text-foreground">Products & variations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage the products and strains or flavors used when starting a batch.</p>
      <p className="mt-2 text-xs font-medium text-muted-foreground">{activeProductCount} active products · {activeVariationCount} active variations</p>
    </div>
    {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>}

    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Brands</h2>
      <div className="mt-3 flex flex-wrap gap-2">{brands.map((brand) => <span key={brand.id} className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm">{brand.name}</span>)}</div>
      <div className="mt-3 flex gap-2">
        <input value={brandName} onChange={(event) => setBrandName(event.target.value.slice(0, 100))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBrand() } }} placeholder="New brand name" className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base" />
        <button onClick={addBrand} disabled={busy === 'brand' || !brandName.trim()} className="bf-btn bf-btn-success"><PlusIcon className="h-4 w-4" /> Add</button>
      </div>
    </section>

    <section>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-foreground">Catalog</h2><p className="text-xs text-muted-foreground">Archiving hides an item from future batches. Existing history stays intact.</p></div>
        <button onClick={() => setShowArchived((value) => !value)} className="bf-btn bf-btn-secondary bf-btn-sm shrink-0">{showArchived ? 'Active' : 'Archived'}</button>
      </div>
      <div className="mt-3 space-y-5">
        {brandGroups.map((brand) => <div key={brand}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{brand}</h3>
          <div className="space-y-3">{visible.filter((product) => (product.brand || 'Unassigned') === brand).map((product) => {
            const activeVariations = product.variations.filter((variation) => !variation.archivedAt)
            const archivedVariations = product.variations.filter((variation) => variation.archivedAt)
            const displayedVariations = showArchivedVariations[product.id] ? product.variations : activeVariations
            return <article key={product.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex min-h-[48px] items-start gap-2">
                {editingId === product.id ? <>
                  <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value.slice(0, 120))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); renameProduct(product) } else if (event.key === 'Escape') setEditingId('') }} aria-label="Product name" className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base" />
                  <button onClick={() => renameProduct(product)} disabled={busy === product.id || !editingName.trim()} className="bf-icon-btn text-emerald-600" aria-label={`Save ${product.name} name`}><CheckIcon className="h-5 w-5" /></button>
                  <button onClick={() => setEditingId('')} className="bf-icon-btn" aria-label="Cancel rename"><XMarkIcon className="h-5 w-5" /></button>
                </> : <>
                  <div className="min-w-0 flex-1"><p className="text-base font-semibold text-foreground">{product.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{categoryLabels[product.recipe.category] || 'Other'} · {product.recipe.name}</p></div>
                  <button onClick={() => { setEditingId(product.id); setEditingName(product.name); setError('') }} disabled={busy === product.id} className="bf-icon-btn" aria-label={`Rename ${product.name}`}><PencilIcon className="h-5 w-5" /></button>
                  <button onClick={() => toggleArchive(product)} disabled={busy === product.id} className="bf-icon-btn" aria-label={product.archivedAt ? `Restore ${product.name}` : `Archive ${product.name}`}>{product.archivedAt ? <ArrowUturnLeftIcon className="h-5 w-5" /> : <ArchiveBoxIcon className="h-5 w-5" />}</button>
                </>}
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variations ({activeVariations.length})</p>
                  {archivedVariations.length > 0 && <button type="button" onClick={() => setShowArchivedVariations((current) => ({ ...current, [product.id]: !current[product.id] }))} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">{showArchivedVariations[product.id] ? 'Hide archived' : `${archivedVariations.length} archived`}</button>}
                </div>
                <div className="mt-2 space-y-2">
                  {displayedVariations.map((variation) => <div key={variation.id} className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 ${variation.archivedAt ? 'border-dashed border-border bg-muted/30 text-muted-foreground' : 'border-border bg-muted/50 text-foreground'}`}>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{variation.name}</span>
                    <button type="button" onClick={() => toggleVariationArchive(product, variation)} disabled={busy === `variation-${variation.id}`} className="bf-icon-btn h-9 w-9" aria-label={variation.archivedAt ? `Restore ${variation.name}` : `Archive ${variation.name}`}>{variation.archivedAt ? <ArrowUturnLeftIcon className="h-4 w-4" /> : <ArchiveBoxIcon className="h-4 w-4" />}</button>
                  </div>)}
                  {displayedVariations.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">No variations yet.</p>}
                </div>
                {!product.archivedAt && <div className="mt-3 flex gap-2">
                  <input value={variationNames[product.id] || ''} onChange={(event) => setVariationNames((current) => ({ ...current, [product.id]: event.target.value.slice(0, 120) }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addVariation(product) } }} placeholder="Add strain or flavor" aria-label={`New variation for ${product.name}`} className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base" />
                  <button type="button" onClick={() => addVariation(product)} disabled={busy === `add-${product.id}` || !(variationNames[product.id] || '').trim()} className="bf-btn bf-btn-success bf-btn-sm"><PlusIcon className="h-4 w-4" /> Add</button>
                </div>}
              </div>
            </article>
          })}</div>
        </div>)}
        {visible.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No {showArchived ? 'archived' : 'active'} products.</p>}
      </div>
    </section>
  </div>
}
