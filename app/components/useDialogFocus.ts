'use client'
import { useEffect, useRef, type RefObject } from 'react'

// A shared stack prevents an outer sheet from handling a nested dialog's keys.
const stack: HTMLElement[] = []
let originalOverflow = ''
let restoreBackground: (() => void) | undefined
function isolateTop() {
  restoreBackground?.()
  const panel = stack[stack.length - 1]
  if (!panel) { restoreBackground = undefined; return }
  const changed: { node: HTMLElement; inert: boolean }[] = []
  let branch: HTMLElement = panel
  while (branch.parentElement) {
    for (const sibling of Array.from(branch.parentElement.children)) {
      if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) {
        changed.push({ node: sibling, inert: sibling.inert }); sibling.inert = true
      }
    }
    branch = branch.parentElement
  }
  restoreBackground = () => changed.forEach(({ node, inert }) => { node.inert = inert })
}

export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, busy = false) {
  const state = useRef({ onClose, busy })
  state.current = { onClose, busy }
  useEffect(() => {
    if (!open) return
    const panel = ref.current
    if (!panel) return
    const previous = document.activeElement as HTMLElement | null
    if (!stack.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    stack.push(panel)
    isolateTop()
    const top = () => stack[stack.length - 1] === panel
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(el => !el.closest('[inert]') && el.getClientRects().length > 0)
    panel.tabIndex = -1
    ;(focusable()[0] || panel).focus()
    const focus = (event: FocusEvent) => { if (top() && !panel.contains(event.target as Node)) (focusable()[0] || panel).focus() }
    const key = (event: KeyboardEvent) => {
      if (!top()) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!state.current.busy) state.current.onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); panel.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus)
      const wasTop = top()
      stack.splice(stack.indexOf(panel), 1)
      isolateTop()
      if (!stack.length) document.body.style.overflow = originalOverflow
      if (wasTop && previous?.isConnected && !previous.closest('[inert]')) previous.focus()
    }
  }, [ref, open])
}
