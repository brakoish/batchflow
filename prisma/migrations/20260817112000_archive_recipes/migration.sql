-- Keep recipes referenced by historical batches while allowing operators to
-- remove them from recipe lists and future batch creation.
ALTER TABLE "Recipe" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Recipe_organizationId_archivedAt_idx"
ON "Recipe"("organizationId", "archivedAt");
