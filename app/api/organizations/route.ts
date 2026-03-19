import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Generate slug from name
    let slug = slugify(name)

    // Ensure slug is unique
    let existingOrg = await prisma.organization.findUnique({ where: { slug } })
    let counter = 1
    while (existingOrg) {
      slug = `${slugify(name)}-${counter}`
      existingOrg = await prisma.organization.findUnique({ where: { slug } })
      counter++
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
      },
    })

    // Update user to be part of this org and make them OWNER
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        organizationId: organization.id,
        role: 'OWNER',
      },
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Create organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await requireSession()

    if (!session.user.organizationId) {
      return NextResponse.json({ error: 'No organization associated' }, { status: 404 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        _count: {
          select: {
            workers: true,
            batches: true,
            recipes: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Get organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
