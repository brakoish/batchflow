import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { authErrorResponse } from '@/lib/apiErrors'

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session.user.workerId) return NextResponse.json({ error: 'Worker profile required' }, { status: 400 })
    const { preferredLanguage } = await request.json()
    if (!['en', 'zh-CN'].includes(preferredLanguage)) return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
    await prisma.worker.updateMany({
      where: { id: session.user.workerId, organizationId: session.user.organizationId },
      data: { preferredLanguage },
    })
    return NextResponse.json({ preferredLanguage })
  } catch (error) {
    const authError = authErrorResponse(error)
    if (authError) return authError
    console.error('workers/me/preferences failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
