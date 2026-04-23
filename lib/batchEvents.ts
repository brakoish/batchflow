/**
 * Cross-component batch mutation events.
 *
 * Fire `emitBatchChanged(batchId?)` after any mutation that affects batch
 * data (edits, status changes, progress logs, etc.). Any list/detail view
 * subscribed via `onBatchChanged(handler)` will refresh immediately,
 * without waiting for the next poll tick.
 *
 * Pattern mirrors the existing `shift-changed` event.
 */

export const BATCH_CHANGED = 'batch-changed'

export type BatchChangedDetail = {
  batchId?: string
  /** Optional origin tag for debugging ("log", "edit", "status", ...) */
  source?: string
}

/** Fire a batch-changed event. Safe to call on the server (no-ops). */
export function emitBatchChanged(
  batchId?: string,
  source?: string,
): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(
      new CustomEvent<BatchChangedDetail>(BATCH_CHANGED, {
        detail: { batchId, source },
      }),
    )
  } catch {
    // CustomEvent may fail in ancient envs; fall back to plain Event
    window.dispatchEvent(new Event(BATCH_CHANGED))
  }
}

/**
 * Subscribe to batch-changed events. Returns an unsubscribe function for
 * convenient use inside a useEffect cleanup.
 *
 * @example
 *   useEffect(() => onBatchChanged(({ batchId }) => refetch(batchId)), [])
 */
export function onBatchChanged(
  handler: (detail: BatchChangedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => {
    const ce = e as CustomEvent<BatchChangedDetail>
    handler(ce.detail || {})
  }
  window.addEventListener(BATCH_CHANGED, listener)
  return () => window.removeEventListener(BATCH_CHANGED, listener)
}
