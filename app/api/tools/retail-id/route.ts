import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

type RetailIdPayload = {
  packageLabel?: string
  productCard?: {
    productName?: string
    strain?: string
  } | null
  coaCard?: {
    data?: string
  } | null
}

const REQUEST_TIMEOUT_MS = 8_000

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BatchFlow Retail ID Scanner',
        ...init?.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function resolveLandingPage(scannedValue: string) {
  let scannedUrl: URL

  try {
    scannedUrl = new URL(scannedValue)
  } catch {
    throw new Error('This QR code does not contain a valid web address.')
  }

  if (scannedUrl.protocol !== 'https:') {
    throw new Error('This is not a secure Retail ID link.')
  }

  if (scannedUrl.hostname.toLowerCase() === '1a4.com') {
    const response = await fetchWithTimeout(scannedUrl.toString(), {
      redirect: 'manual',
    })
    const location = response.headers.get('location')

    if (!location) {
      throw new Error('Retail ID did not return a product page.')
    }

    scannedUrl = new URL(location, scannedUrl)
  }

  if (scannedUrl.hostname.toLowerCase() !== 'app.1a4.com') {
    throw new Error('That QR code is not a Metrc Retail ID.')
  }

  const match = scannedUrl.pathname.match(
    /^\/landingpage\/([a-z0-9]+)\/(\d+)\/?$/i
  )

  if (!match) {
    throw new Error('The Retail ID link format is not recognized.')
  }

  return {
    issuanceId: match[1],
    index: match[2],
    sourceUrl: scannedUrl.toString(),
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const scannedValue =
      typeof body?.url === 'string' ? body.url.trim() : ''

    if (!scannedValue) {
      return NextResponse.json(
        { error: 'Scan a Retail ID QR code first.' },
        { status: 400 }
      )
    }

    const { issuanceId, index, sourceUrl } =
      await resolveLandingPage(scannedValue)
    const apiUrl = new URL('https://app.1a4.com/api/landingpage/data')
    apiUrl.searchParams.set('id', issuanceId)
    apiUrl.searchParams.set('index', index)

    const response = await fetchWithTimeout(apiUrl.toString())
    if (!response.ok) {
      throw new Error('Retail ID could not find that item.')
    }

    const payload = (await response.json()) as RetailIdPayload
    let coa: Record<string, unknown> = {}

    if (payload.coaCard?.data) {
      try {
        coa = JSON.parse(payload.coaCard.data)
      } catch {
        // The product card normally supplies the name; malformed COA data
        // should not prevent a successful scan.
      }
    }

    const name = [
      payload.productCard?.productName,
      coa.productName,
      coa.title,
    ].find((value): value is string =>
      typeof value === 'string' && value.trim().length > 0
    )

    if (!name) {
      throw new Error('Retail ID returned the item, but no product name.')
    }

    const strain = [
      payload.productCard?.strain,
      coa.strainName,
      coa.strain,
    ].find((value): value is string =>
      typeof value === 'string' && value.trim().length > 0
    )

    return NextResponse.json({
      name: name.trim(),
      strain: strain?.trim() || null,
      packageLabel:
        payload.packageLabel ||
        (typeof coa.id === 'string' ? coa.id : null),
      sourceUrl,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Retail ID took too long to respond. Try again.'
        : error instanceof Error
          ? error.message
          : 'Could not read that Retail ID.'

    return NextResponse.json({ error: message }, { status: 422 })
  }
}
