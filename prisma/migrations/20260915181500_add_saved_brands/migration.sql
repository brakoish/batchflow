CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_organizationId_name_key" ON "Brand"("organizationId", "name");
CREATE INDEX "Brand_organizationId_archivedAt_idx" ON "Brand"("organizationId", "archivedAt");
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Brand" ("id", "name", "organizationId", "createdAt")
SELECT 'brand_' || md5(p."organizationId" || ':' || trim(p."brand")), trim(p."brand"), p."organizationId", CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."brand" IS NOT NULL AND trim(p."brand") <> ''
GROUP BY p."organizationId", trim(p."brand")
ON CONFLICT ("organizationId", "name") DO NOTHING;
