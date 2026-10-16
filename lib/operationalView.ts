/** Read-only view rules shared with operational screens; never change ledger records. */
export function stockAfterAdjustments(recorded: number, deltas: number[]) {
  return Math.max(0, recorded + deltas.reduce((sum, delta) => sum + delta, 0))
}

export function isCurrentHoursQuery(loaded: string, requested: string, loading: boolean, error: string) {
  return loaded === requested && !loading && !error
}
