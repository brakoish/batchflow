import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workerId = searchParams.get('workerId')
  const token = searchParams.get('token')

  if (token !== 'emergency2024') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!workerId) {
    return NextResponse.json({ error: 'Missing workerId' }, { status: 400 })
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, name: true, role: true },
  })

  if (!worker) {
    return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
  }

  const cookieStore = await cookies()
  const sevenDays = 60 * 60 * 24 * 7
  cookieStore.set('workerId', worker.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sevenDays,
    expires: new Date(Date.now() + sevenDays * 1000), // iOS PWA needs explicit expires
  })

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
