ALTER TABLE "Batch" ADD COLUMN "leadWorkerId" TEXT;

CREATE TABLE "WorkTeam" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkTeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkTeam_organizationId_name_key" ON "WorkTeam"("organizationId", "name");
CREATE INDEX "WorkTeam_organizationId_idx" ON "WorkTeam"("organizationId");
CREATE UNIQUE INDEX "WorkTeamMember_teamId_workerId_key" ON "WorkTeamMember"("teamId", "workerId");
CREATE INDEX "WorkTeamMember_workerId_idx" ON "WorkTeamMember"("workerId");
CREATE INDEX "Batch_leadWorkerId_idx" ON "Batch"("leadWorkerId");

ALTER TABLE "WorkTeam" ADD CONSTRAINT "WorkTeam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTeamMember" ADD CONSTRAINT "WorkTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTeamMember" ADD CONSTRAINT "WorkTeamMember_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_leadWorkerId_fkey" FOREIGN KEY ("leadWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
