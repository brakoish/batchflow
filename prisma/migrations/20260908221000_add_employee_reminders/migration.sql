-- Reusable organization reminders and per-worker enablement/delivery state.
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🔔',
    "intervalMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerReminder" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkerReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reminder_organizationId_idx" ON "Reminder"("organizationId");
CREATE UNIQUE INDEX "WorkerReminder_reminderId_workerId_key" ON "WorkerReminder"("reminderId", "workerId");
CREATE INDEX "WorkerReminder_workerId_enabled_idx" ON "WorkerReminder"("workerId", "enabled");

ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerReminder" ADD CONSTRAINT "WorkerReminder_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerReminder" ADD CONSTRAINT "WorkerReminder_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
