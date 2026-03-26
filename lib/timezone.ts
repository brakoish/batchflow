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
    hour12: false,
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
  // Parse the datetime-local string
  const [datePart, timePart] = dateTimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Create a date string in the target timezone
  // We use en-US format that includes timezone offset
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  // Get the timezone offset at this specific date/time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset'
  });

  // Create a date in the target timezone and parse the offset
  const testDate = new Date(`${dateStr}Z`); // Start with UTC
  const formatted = formatter.format(testDate);

  // Extract offset from formatted string (e.g., "GMT-04:00" or "GMT+05:30")
  const offsetMatch = formatted.match(/GMT([+-]\d{2}):(\d{2})/);

  if (!offsetMatch) {
    // Fallback: construct date assuming no DST
    // This is a simplified approach and may not be perfectly accurate
    return new Date(`${dateStr}Z`);
  }

  const offsetHours = parseInt(offsetMatch[1], 10);
  const offsetMinutes = parseInt(offsetMatch[2], 10) * (offsetHours < 0 ? -1 : 1);
  const totalOffsetMinutes = offsetHours * 60 + offsetMinutes;

  // Create a date in the specified timezone by adjusting for the offset
  const utcTime = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(utcTime - totalOffsetMinutes * 60 * 1000);
}
