-- CreateTable
CREATE TABLE "DirectedTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "batchId" TEXT,
    "stepId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "contentRevision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectedTaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "blockedNote" TEXT NOT NULL DEFAULT '',
    "seenRevision" INTEGER NOT NULL DEFAULT 0,
    "removedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectedTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectedTask_organizationId_archivedAt_startDate_idx" ON "DirectedTask"("organizationId", "archivedAt", "startDate");

-- CreateIndex
CREATE INDEX "DirectedTaskAssignment_workerId_removedAt_idx" ON "DirectedTaskAssignment"("workerId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectedTaskAssignment_taskId_workerId_key" ON "DirectedTaskAssignment"("taskId", "workerId");

-- AddForeignKey
ALTER TABLE "DirectedTask" ADD CONSTRAINT "DirectedTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectedTaskAssignment" ADD CONSTRAINT "DirectedTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "DirectedTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectedTaskAssignment" ADD CONSTRAINT "DirectedTaskAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
