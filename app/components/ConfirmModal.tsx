'use client'

import { translateUi } from '@/lib/uiLocale'
import { useEffect, useRef } from 'react'
import { haptic } from '@/lib/haptic'

type ConfirmModalProps = {
  language?: string
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  confirmStyle?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  language = 'en', open, title, message, confirmLabel = 'Confirm', confirmStyle = 'danger', onConfirm, onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      if (event.key === 'Tab') {
        const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if (!buttons?.length) return
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [open, onCancel])
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-label={title}
        className="max-h-[90dvh] overflow-y-auto w-full max-w-sm bg-card border rounded-t-2xl sm:rounded-2xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <p className="text-base font-semibold text-foreground mb-1">{title}</p>
          {message && <p className="text-sm text-muted-foreground mb-5">{message}</p>}
          {!message && <div className="mb-5" />}

          <div className="flex gap-3">
            <button
              onClick={() => { haptic('light'); onCancel() }}
              className="flex-1 py-3.5 min-h-[44px] rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-sm transition-all active:scale-[0.98]"
            >
              {translateUi('Cancel', language)}
            </button>
            <button
              onClick={() => { haptic('medium'); onConfirm() }}
              className={`flex-1 py-3.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                confirmStyle === 'danger'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {translateUi(confirmLabel, language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
