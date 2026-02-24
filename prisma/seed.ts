import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create Workers
  const owner = await prisma.worker.upsert({
    where: { pin: '1234' },
    update: {},
    create: {
      name: 'Will',
      pin: '1234',
      role: 'OWNER',
    },
  })

  const maria = await prisma.worker.upsert({
    where: { pin: '2241' },
    update: {},
    create: {
      name: 'Maria',
      pin: '2241',
      role: 'WORKER',
    },
  })

  const james = await prisma.worker.upsert({
    where: { pin: '3356' },
    update: {},
    create: {
      name: 'James',
      pin: '3356',
      role: 'WORKER',
    },
  })

  console.log('Created workers:', { owner, maria, james })

  // Create Recipe with Steps
  const recipe = await prisma.recipe.create({
    data: {
      name: '14g Ground Flower',
      description: 'Standard 14g ground flower bags',
      steps: {
        create: [
          { name: 'Prep Bags', order: 1, notes: 'Set up bagging station' },
          {
            name: 'Measure Flower',
            order: 2,
            notes: 'Weigh out 14g portions',
          },
          { name: 'Sift Flower', order: 3, notes: 'Remove stems and seeds' },
          { name: 'Fill Bags', order: 4, notes: 'Set filler to 14g' },
          { name: 'Label Bags', order: 5, notes: 'Apply strain labels' },
          {
            name: 'Pack Master Cases',
            order: 6,
            notes: '50 bags per case',
          },
          { name: 'Sticker Cases', order: 7, notes: 'Apply compliance stickers' },
          {
            name: 'Box for Shipping',
            order: 8,
            notes: 'Prepare for transport',
          },
        ],
      },
    },
    include: {
      steps: true,
    },
  })

  console.log('Created recipe:', recipe)

  // Create Active Batch
  const batch = await prisma.batch.create({
    data: {
      name: '14g Ground Flower Batch #047',
      recipeId: recipe.id,
      targetQuantity: 500,
      status: 'ACTIVE',
      startDate: new Date(),
      steps: {
        create: recipe.steps.map((step, index) => ({
          recipeStepId: step.id,
          name: step.name,
          order: step.order,
          targetQuantity: 500,
          completedQuantity: 0,
          status: index === 0 ? 'IN_PROGRESS' : 'LOCKED',
        })),
      },
    },
    include: {
      steps: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  console.log('Created batch:', batch)

  // Add some progress logs to simulate work
  const step1 = batch.steps[0]
  const step2 = batch.steps[1]

  // Maria logs progress on step 1
  await prisma.progressLog.create({
    data: {
      batchStepId: step1.id,
      workerId: maria.id,
      quantity: 200,
      note: 'Morning shift progress',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  })

  await prisma.batchStep.update({
    where: { id: step1.id },
    data: {
      completedQuantity: 200,
      status: 'IN_PROGRESS',
    },
  })

  // James logs progress on step 1
  await prisma.progressLog.create({
    data: {
      batchStepId: step1.id,
      workerId: james.id,
      quantity: 150,
      note: 'Afternoon batch',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
  })

  await prisma.batchStep.update({
    where: { id: step1.id },
    data: {
      completedQuantity: 350,
      status: 'IN_PROGRESS',
    },
  })

  // Unlock step 2
  await prisma.batchStep.update({
    where: { id: step2.id },
    data: {
      status: 'IN_PROGRESS',
    },
  })

  // Maria starts step 2
  await prisma.progressLog.create({
    data: {
      batchStepId: step2.id,
      workerId: maria.id,
      quantity: 150,
      note: 'Started measuring',
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    },
  })

  await prisma.batchStep.update({
    where: { id: step2.id },
    data: {
      completedQuantity: 150,
      status: 'IN_PROGRESS',
    },
  })

  console.log('Added progress logs')
  console.log('Seed completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
