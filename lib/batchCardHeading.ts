type HeadingBatch = { name: string; strain?: string | null; product?: { name: string; brand?: string | null } | null; recipe: { name: string; brand?: string | null } }

/** Display-only hierarchy; never parse or rewrite the batch's identity. */
export function batchCardHeading(batch: HeadingBatch) {
  const strain = batch.strain?.trim()
  const productName = batch.product?.name || ''
  // The same strain can be packaged in both formats; keep that identity primary.
  const format = /\bdisposable\b/i.test(productName) ? 'Disposable'
    : /\bcartridge\b|\b510\b/i.test(productName) ? 'Cartridge' : null
  const flowerBag = productName.match(/\b(\d+(?:\.\d+)?)g\s+Flower\s+Bags?\b/i)
  const preRollPack = productName.match(/\b(\d+)-Pack\s+(\d+(?:\.\d+)?)g\s+Pre-Rolls?\b/i)
  const packageFormat = flowerBag ? `${flowerBag[1]}g Flower Bags`
    : preRollPack ? `${preRollPack[1]} × ${preRollPack[2]}g Pre-Rolls` : format
  const title = strain ? [strain, packageFormat].filter(Boolean).join(' · ') : batch.name
  const brand = batch.product?.brand?.trim() || batch.recipe.brand?.trim()
  let product = batch.product?.name.trim() || batch.recipe.name.trim()
  // Strip only an exact structured brand prefix, not arbitrary name segments.
  if (brand && product.toLowerCase().startsWith(`${brand.toLowerCase()} - `)) product = product.slice(brand.length + 3)
  const subtitle = [brand, product].filter((value, index, all) => value && value !== title && all.indexOf(value) === index).join(' · ')
  return { title, subtitle }
}
