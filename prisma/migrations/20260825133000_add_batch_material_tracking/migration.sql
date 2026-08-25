-- Optional bulk-material accountability for production batches.
CREATE TYPE "BatchMaterialEventType" AS ENUM ('ISSUE', 'ADDITION', 'RETURN', 'WASTE', 'RECONCILE');

ALTER TABLE "Batch"
ADD COLUMN "materialName" TEXT,
ADD COLUMN "materialUnit" TEXT,
ADD COLUMN "materialRatio" DOUBLE PRECISION,
ADD COLUMN "materialReconciledAt" TIMESTAMP(3);

CREATE TABLE "BatchMaterialEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "workerId" TEXT,
    "actorName" TEXT NOT NULL,
    "type" "BatchMaterialEventType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchMaterialEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BatchMaterialEvent_batchId_idx" ON "BatchMaterialEvent"("batchId");
CREATE INDEX "BatchMaterialEvent_workerId_idx" ON "BatchMaterialEvent"("workerId");
CREATE INDEX "BatchMaterialEvent_createdAt_idx" ON "BatchMaterialEvent"("createdAt");

ALTER TABLE "BatchMaterialEvent" ADD CONSTRAINT "BatchMaterialEvent_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchMaterialEvent" ADD CONSTRAINT "BatchMaterialEvent_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
