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
          { name: 'Prep Bags', order: 1, notes: 'Pull correct qty of bags', type: 'CHECK' },
          {
            name: 'Measure Flower',
            order: 2,
            notes: 'Weigh out total ground flower needed',
            type: 'CHECK',
          },
          { name: 'Sift Flower', order: 3, notes: 'Remove stems and seeds', type: 'CHECK' },
          { name: 'Fill Bags', order: 4, notes: 'Set filler to 14g', type: 'COUNT' },
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
          type: step.type,
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
  const step1 = batch.steps[0] // Prep Bags (CHECK)
  const step2 = batch.steps[1] // Measure Flower (CHECK)
  const step3 = batch.steps[2] // Sift Flower (CHECK)
  const step4 = batch.steps[3] // Fill Bags (COUNT)

  // Maria completed Prep Bags (CHECK step)
  await prisma.progressLog.create({
    data: {
      batchStepId: step1.id,
      workerId: maria.id,
      quantity: 500,
      note: 'Bags ready',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  })
  await prisma.batchStep.update({
    where: { id: step1.id },
    data: { completedQuantity: 500, status: 'COMPLETED' },
  })

  // Maria completed Measure Flower (CHECK step)
  await prisma.progressLog.create({
    data: {
      batchStepId: step2.id,
      workerId: maria.id,
      quantity: 500,
      note: 'Weighed out',
      createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    },
  })
  await prisma.batchStep.update({
    where: { id: step2.id },
    data: { completedQuantity: 500, status: 'COMPLETED' },
  })

  // James completed Sift Flower (CHECK step)
  await prisma.progressLog.create({
    data: {
      batchStepId: step3.id,
      workerId: james.id,
      quantity: 500,
      note: 'All sifted',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  })
  await prisma.batchStep.update({
    where: { id: step3.id },
    data: { completedQuantity: 500, status: 'COMPLETED' },
  })

  // Fill Bags is now IN_PROGRESS (COUNT step)
  await prisma.batchStep.update({
    where: { id: step4.id },
    data: { status: 'IN_PROGRESS' },
  })

  // Maria filled 200 bags
  await prisma.progressLog.create({
    data: {
      batchStepId: step4.id,
      workerId: maria.id,
      quantity: 200,
      note: 'Morning shift',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  })

  // James filled 150 bags
  await prisma.progressLog.create({
    data: {
      batchStepId: step4.id,
      workerId: james.id,
      quantity: 150,
      note: 'Afternoon batch',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  })

  await prisma.batchStep.update({
    where: { id: step4.id },
    data: { completedQuantity: 350 },
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
