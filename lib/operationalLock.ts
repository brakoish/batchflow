import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Every production/inventory mutation takes this lock BEFORE reading its snapshot.
// ReadCommitted ensures a waiter sees the preceding transaction's committed writes.
// This is serialization, not idempotency: additive requests must not be auto-retried
// after an ambiguous response; durable request keys require a schema migration.
export async function withOperationalLock<T>(organizationId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`
    return operation(tx)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 })
}
