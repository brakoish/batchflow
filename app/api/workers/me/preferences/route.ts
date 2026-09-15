import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

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
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
