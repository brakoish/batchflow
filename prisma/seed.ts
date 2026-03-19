import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'excelsior' },
    update: {},
    create: {
      name: 'Excelsior',
      slug: 'excelsior',
    },
  })

  console.log('Created organization: Excelsior')

  // Create Workers
  const owner = await prisma.worker.upsert({
    where: { pin: '1234' },
    update: {},
    create: {
      name: 'Will',
      pin: '1234',
      role: 'OWNER',
      organization: { connect: { id: org.id } }
    },
  })

  const maria = await prisma.worker.upsert({
    where: { pin: '2241' },
    update: {},
    create: {
      name: 'Maria',
      pin: '2241',
      role: 'WORKER',
      organization: { connect: { id: org.id } }
    },
  })

  const james = await prisma.worker.upsert({
    where: { pin: '3356' },
    update: {},
    create: {
      name: 'James',
      pin: '3356',
      role: 'WORKER',
      organization: { connect: { id: org.id } }
    },
  })

  console.log('Created workers')

  // Create Users for each worker
  await prisma.user.upsert({
    where: { email: 'will@example.com' },
    update: {},
    create: {
      email: 'will@example.com',
      name: 'Will',
      role: 'OWNER',
      organizationId: org.id,
      workerId: owner.id,
    },
  })

  await prisma.user.upsert({
    where: { workerId: maria.id },
    update: {},
    create: {
      name: 'Maria',
      role: 'WORKER',
      organizationId: org.id,
      workerId: maria.id,
    },
  })

  await prisma.user.upsert({
    where: { workerId: james.id },
    update: {},
    create: {
      name: 'James',
      role: 'WORKER',
      organizationId: org.id,
      workerId: james.id,
    },
  })

  console.log('Created users')

  // Create Recipe with Units
  const recipe = await prisma.recipe.create({
    data: {
      name: '14g Ground Flower',
      description: 'Standard 14g ground flower bags',
      baseUnit: 'bags',
      organizationId: org.id,
      units: {
        create: [
          { name: 'cases', ratio: 20, order: 0 },
          { name: 'boxes', ratio: 100, order: 1 },
        ],
      },
    },
    include: { units: true },
  })

  const caseUnit = recipe.units.find(u => u.name === 'cases')!
  const boxUnit = recipe.units.find(u => u.name === 'boxes')!

  // Create Steps
  const stepDefs = [
    { name: 'Collect Bags', type: 'CHECK' as const, notes: 'Pull correct qty', unitId: null },
    { name: 'Measure Flower', type: 'CHECK' as const, notes: 'Weigh total needed', unitId: null },
    { name: 'Sift Flower', type: 'CHECK' as const, notes: 'Remove stems', unitId: null },
    { name: 'Fill Bags', type: 'COUNT' as const, notes: 'Set filler to 14g', unitId: null },
    { name: 'Label (×3)', type: 'COUNT' as const, notes: '3 labels per bag', unitId: null },
    { name: 'Pack Master Cases', type: 'COUNT' as const, notes: '20 bags per case', unitId: caseUnit.id },
    { name: 'Sticker Cases', type: 'COUNT' as const, notes: 'Compliance stickers', unitId: caseUnit.id },
    { name: 'Box for Shipping', type: 'COUNT' as const, notes: '5 cases per box', unitId: boxUnit.id },
  ]

  for (let i = 0; i < stepDefs.length; i++) {
    await prisma.recipeStep.create({
      data: {
        recipeId: recipe.id,
        name: stepDefs[i].name,
        type: stepDefs[i].type,
        notes: stepDefs[i].notes,
        order: i + 1,
        unitId: stepDefs[i].unitId,
      },
    })
  }

  const recipeSteps = await prisma.recipeStep.findMany({
    where: { recipeId: recipe.id },
    orderBy: { order: 'asc' },
    include: { unit: true },
  })

  console.log('Created recipe with units')

  // Create Batch (500 bags)
  const batchTarget = 500
  const batch = await prisma.batch.create({
    data: {
      name: '14g Ground Flower Batch #047',
      recipeId: recipe.id,
      targetQuantity: batchTarget,
      baseUnit: 'bags',
      status: 'ACTIVE',
      organizationId: org.id,
      steps: {
        create: recipeSteps.map((step, i) => {
          const ratio = step.unit?.ratio || 1
          const label = step.unit?.name || 'bags'
          return {
            recipeStepId: step.id,
            name: step.name,
            order: step.order,
            type: step.type,
            unitLabel: label,
            unitRatio: ratio,
            targetQuantity: Math.ceil(batchTarget / ratio),
            completedQuantity: 0,
            status: i === 0 ? 'IN_PROGRESS' : 'LOCKED',
          }
        }),
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  console.log('Created batch')

  // Simulate progress
  const steps = batch.steps

  // Complete CHECK steps
  for (let i = 0; i < 3; i++) {
    await prisma.progressLog.create({
      data: {
        batchStepId: steps[i].id,
        workerId: maria.id,
        quantity: steps[i].targetQuantity,
        note: 'Done',
        createdAt: new Date(Date.now() - (3 - i) * 60 * 60 * 1000),
      },
    })
    await prisma.batchStep.update({
      where: { id: steps[i].id },
      data: { completedQuantity: steps[i].targetQuantity, status: 'COMPLETED' },
    })
  }

  // Fill Bags in progress
  await prisma.batchStep.update({ where: { id: steps[3].id }, data: { status: 'IN_PROGRESS' } })
  await prisma.progressLog.create({
    data: { batchStepId: steps[3].id, workerId: maria.id, quantity: 200, note: 'Morning shift' },
  })
  await prisma.progressLog.create({
    data: { batchStepId: steps[3].id, workerId: james.id, quantity: 150, note: 'Afternoon' },
  })
  await prisma.batchStep.update({ where: { id: steps[3].id }, data: { completedQuantity: 350 } })

  // Unlock Label step
  await prisma.batchStep.update({ where: { id: steps[4].id }, data: { status: 'IN_PROGRESS' } })
  await prisma.progressLog.create({
    data: { batchStepId: steps[4].id, workerId: james.id, quantity: 100, note: 'Started labeling' },
  })
  await prisma.batchStep.update({ where: { id: steps[4].id }, data: { completedQuantity: 100 } })

  console.log('Added progress. Seed complete!')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
