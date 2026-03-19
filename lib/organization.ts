import { prisma } from './prisma'

export async function getOrganizationName(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return org?.name || null
}
