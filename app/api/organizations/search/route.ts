import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')

    if (!q || q.trim().length < 1) {
      return NextResponse.json({ organizations: [] })
    }

    const query = q.trim()

    // Search by name or slug (case-insensitive)
    const organizations = await prisma.organization.findMany({
      where: {
        AND: [
          // Exclude the default org
          { id: { not: 'default-org-id' } },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query.toLowerCase().replace(/\s+/g, '-'), mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      take: 5,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('Search organizations error:', error)
    return NextResponse.json({ organizations: [] })
  }
}
