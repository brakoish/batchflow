type HeadingBatch = { name: string; strain?: string | null; product?: { name: string; brand?: string | null } | null; recipe: { name: string; brand?: string | null } }

/** Display-only hierarchy; never parse or rewrite the batch's identity. */
export function batchCardHeading(batch: HeadingBatch) {
  const title = batch.strain?.trim() || batch.name
  const brand = batch.product?.brand?.trim() || batch.recipe.brand?.trim()
  let product = batch.product?.name.trim() || batch.recipe.name.trim()
  // Strip only an exact structured brand prefix, not arbitrary name segments.
  if (brand && product.toLowerCase().startsWith(`${brand.toLowerCase()} - `)) product = product.slice(brand.length + 3)
  const subtitle = [brand, product].filter((value, index, all) => value && value !== title && all.indexOf(value) === index).join(' · ')
  return { title, subtitle }
}
