/**
 * Timezone utility functions for formatting dates and times in a specific timezone.
 * Uses native Intl.DateTimeFormat API - no external dependencies required.
 */

/**
 * Formats a date/time as time only (e.g., "11:30 AM")
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Formatted time string
 */
export function formatTimeInTz(date: string | Date, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Formats a date/time as date only (e.g., "3/26/2026")
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Formatted date string
 */
export function formatDateInTz(date: string | Date, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats a date/time as both date and time (e.g., "3/26/2026, 11:30 AM")
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Formatted date and time string
 */
export function formatDateTimeInTz(date: string | Date, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Converts a date from one timezone to a datetime-local string for HTML input.
 * This is useful when you need to display UTC dates in a specific timezone in datetime-local inputs.
 * @param date - Date object or ISO string (typically UTC from database)
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns String in format "YYYY-MM-DDTHH:mm" suitable for datetime-local input
 */
export function toDateTimeLocalString(date: string | Date, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // Get the date/time components in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Converts a datetime-local input string to a UTC Date object.
 * The input string is interpreted as being in the specified timezone.
 * @param dateTimeLocal - String in format "YYYY-MM-DDTHH:mm" from datetime-local input
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Date object in UTC
 */
export function fromDateTimeLocalString(dateTimeLocal: string, timezone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTimeLocal)) throw new Error('Invalid local date/time')
  const naive = Date.parse(`${dateTimeLocal}:00Z`)
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== dateTimeLocal) throw new Error('Invalid local date/time')
  // Probe both sides of a transition, then round-trip candidates. Reject gaps
  // and folds rather than silently changing a requested payroll instant.
  const offsets = new Set<number>()
  for (const delta of [-36, -12, 0, 12, 36]) {
    const probe = new Date(naive + delta * 3600000)
    offsets.add(Date.parse(`${toDateTimeLocalString(probe, timezone)}:00Z`) - Math.floor(probe.getTime() / 60000) * 60000)
  }
  const candidates = [...offsets].map(offset => new Date(naive - offset)).filter(d => toDateTimeLocalString(d, timezone) === dateTimeLocal)
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Ambiguous local time during daylight saving transition; choose an unambiguous time' : 'Local time does not exist during daylight saving transition')
  return candidates[0]
}

export function localDateKey(date: string | Date, timezone: string): string {
  return toDateTimeLocalString(date, timezone).slice(0, 10)
}
