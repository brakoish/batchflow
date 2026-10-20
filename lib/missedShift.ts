import { fromDateTimeLocalString } from './timezone'

export function parseMissedShift(input: { startLocal?: unknown; endLocal?: unknown; note?: unknown }, timezone: string, now = new Date()) {
  if (typeof input.startLocal !== 'string' || typeof input.endLocal !== 'string') throw new Error('Enter clock-in and clock-out dates and times')
  const startedAt = fromDateTimeLocalString(input.startLocal, timezone)
  const endedAt = fromDateTimeLocalString(input.endLocal, timezone)
  if (endedAt <= startedAt) throw new Error('Clock-out must be after clock-in')
  if (endedAt > now) throw new Error('A missed shift cannot end in the future')
  if (input.note != null && (typeof input.note !== 'string' || input.note.length > 1000)) throw new Error('Note must be at most 1,000 characters')
  return { startedAt, endedAt, notes: typeof input.note === 'string' ? input.note.trim() || null : null }
}
