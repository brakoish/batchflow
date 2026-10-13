'use client'
import { useEffect, useRef, type RefObject } from 'react'

// Apply to the dialog panel, not its backdrop. Keep callbacks stable in callers.
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, busy = false) {
  const busyRef = useRef(busy)
  busyRef.current = busy
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = ref.current
    if (!panel) return
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(element => element.getClientRects().length > 0)
    panel.tabIndex = -1
    ;(focusable()[0] || panel).focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); onClose() }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); panel.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus() }
  }, [ref, open, onClose])
}
