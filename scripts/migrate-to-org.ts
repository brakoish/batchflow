import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
  console.log('Starting migration to organization structure...')

  try {
    // 1. Check if Excelsior org already exists
    let org = await prisma.organization.findUnique({
      where: { slug: 'excelsior' }
    })

    if (org) {
      console.log('✓ Excelsior organization already exists')
    } else {
      // Create Excelsior organization
      org = await prisma.organization.create({
        data: {
          name: 'Excelsior',
          slug: 'excelsior',
        }
      })
      console.log('✓ Created Excelsior organization')
    }

    // 2. Get all existing workers
    const workers = await prisma.worker.findMany({
      where: {
        organizationId: null, // Only migrate workers without an org
      }
    })

    console.log(`Found ${workers.length} workers to migrate`)

    // 3. Create User for each worker and update worker
    for (const worker of workers) {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: worker.role === 'OWNER' ? 'will@example.com' : undefined },
            { workerId: worker.id }
          ]
        }
      })

      if (existingUser) {
        console.log(`  - User already exists for worker: ${worker.name}`)
        continue
      }

      // Create user for this worker
      const user = await prisma.user.create({
        data: {
          email: worker.role === 'OWNER' ? 'will@example.com' : null,
          name: worker.name,
          role: worker.role,
          organizationId: org.id,
          workerId: worker.id,
        }
      })

      // Update worker to link to organization
      await prisma.worker.update({
        where: { id: worker.id },
        data: { organizationId: org.id }
      })

      console.log(`  ✓ Created user for worker: ${worker.name} (${worker.role})`)
    }

    // 4. Update all batches without an organizationId
    const batchesResult = await prisma.batch.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id }
    })
    console.log(`✓ Updated ${batchesResult.count} batches`)

    // 5. Update all recipes without an organizationId
    const recipesResult = await prisma.recipe.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id }
    })
    console.log(`✓ Updated ${recipesResult.count} recipes`)

    console.log('\n✅ Migration complete!')
    console.log('\nNext steps:')
    console.log('1. Test login flows')
    console.log('2. Verify data is scoped correctly')
    console.log('3. Deploy to production')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
