/**
 * Formats a duration in hours to human-readable format
 * @param hours - Duration in decimal hours (e.g., 6.25 for 6 hours 15 minutes)
 * @returns Formatted string (e.g., "6h 15m", "45m", "0m")
 */
export function formatDuration(hours: number): string {
  if (hours <= 0) return '0m'

  const totalMinutes = Math.round(hours * 60)

  if (totalMinutes < 60) {
    return `${totalMinutes}m`
  }

  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  if (mins === 0) {
    return `${hrs}h`
  }

  return `${hrs}h ${mins}m`
}
