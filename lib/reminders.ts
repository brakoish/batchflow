export function isReminderDue({
  now,
  shiftStartedAt,
  assignmentUpdatedAt,
  lastSentAt,
  intervalMinutes,
}: {
  now: Date
  shiftStartedAt: Date
  assignmentUpdatedAt: Date
  lastSentAt: Date | null
  intervalMinutes: number
}) {
  const baseline = lastSentAt || (assignmentUpdatedAt > shiftStartedAt ? assignmentUpdatedAt : shiftStartedAt)
  return baseline.getTime() + intervalMinutes * 60_000 <= now.getTime()
}
