'use client'

import { translateUi } from '@/lib/uiLocale'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  StopIcon,
  PlayIcon,
  ClockIcon,
  ChartBarIcon,
  MegaphoneIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useDialogFocus } from './useDialogFocus'
import ThemeToggle from './ThemeToggle'
import { haptic } from '@/lib/haptic'
import type { Session } from '@/lib/session'

type Props = {
  session: Session
  open: boolean
  onClose: () => void
}

export default function MoreMenu({ session, open, onClose }: Props) {
  const pathname = usePathname()
  const isOwner = session.role === 'OWNER'
  const [checking, setChecking] = useState(true)
  const [clockError, setClockError] = useState('')
  const [onShift, setOnShift] = useState(false)
  const [clockLoading, setClockLoading] = useState(false)
  const [confirmingClockOut, setConfirmingClockOut] = useState(false)

  // Keep shift state in sync while the sheet is open.
  useEffect(() => {
    if (!open || isOwner) return
    const check = () => {
      fetch('/api/shifts')
        .then((r) => r.json())
        .then((d) => setOnShift(!!d.activeShift))
        .catch(() => setClockError('Unable to check shift. Reopen to retry.'))
        .finally(() => setChecking(false))
    }
    check()
    const onChange = () => check()
    window.addEventListener('shift-changed', onChange)
    return () => window.removeEventListener('shift-changed', onChange)
  }, [open, isOwner])

  // Auto-cancel clock-out confirmation if the user hesitates
  useEffect(() => {
    if (!confirmingClockOut) return
    const t = setTimeout(() => setConfirmingClockOut(false), 4000)
    return () => clearTimeout(t)
  }, [confirmingClockOut])

  const handleClockIn = async () => {
    if (clockLoading) return
    setClockError('')
    haptic('medium')
    setClockLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error || 'Shift change failed')
      window.dispatchEvent(new Event('shift-changed'))
      if (res.ok) {
        setOnShift(true)
        window.dispatchEvent(new Event('shift-changed'))
        onClose()
      }
    } catch (e) { setClockError(e instanceof Error ? e.message : 'Connection error. Try again.') }
    setClockLoading(false)
  }

  const handleClockOutConfirm = async () => {
    if (clockLoading) return
    setClockError('')
    haptic('medium')
    setClockLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (!res.ok) throw new Error((await res.json()).error || 'Shift change failed')
      window.dispatchEvent(new Event('shift-changed'))
      if (res.ok) {
        setOnShift(false)
        setConfirmingClockOut(false)
        window.dispatchEvent(new Event('shift-changed'))
        onClose()
      }
    } catch (e) { setClockError(e instanceof Error ? e.message : 'Connection error. Try again.') }
    setClockLoading(false)
  }

  const handleLogout = async () => {
    haptic('light')
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  // Links shown for the current role. Primary nav items (Batches, Shift,
  // My Day, Dashboard, etc.) intentionally stay in BottomNav — this sheet
  // only surfaces "secondary" destinations.
  type Item = { href: string; label: string; Icon: any }
  const items: Item[] = isOwner
    ? []
    : session.role === 'SUPERVISOR'
      ? [
          { href: '/stock', label: 'Stock', Icon: ClockIcon },
          { href: '/products', label: 'Products', Icon: WrenchScrewdriverIcon },
          { href: '/history', label: 'Batch history', Icon: ClockIcon },
          { href: '/tools', label: 'Tools', Icon: WrenchScrewdriverIcon },
          { href: '/announcements', label: 'Announcements', Icon: MegaphoneIcon },
          { href: '/teams', label: 'Employee teams', Icon: UserGroupIcon },
          { href: '/workers/me/timesheet', label: 'My timesheet', Icon: ClockIcon },
          { href: '/workers/me', label: 'My Day', Icon: ChartBarIcon },
        ]
      : [
        { href: '/stock', label: 'Stock', Icon: ClockIcon },
        { href: '/tools', label: 'Tools', Icon: WrenchScrewdriverIcon },
        { href: '/workers/me/timesheet', label: 'My timesheet', Icon: ClockIcon },
        { href: '/workers/me', label: 'My Day', Icon: ChartBarIcon },
      ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const closePanel = useCallback(() => closeRef.current(), [])
  useDialogFocus(panelRef, open, closePanel, clockLoading)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={() => { if (!clockLoading) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={translateUi('More', session.preferredLanguage)}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl safe-bottom max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle (iOS-style) */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-border">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{session.name || 'Account'}</p>
            <p className="text-[11px] text-muted-foreground">{translateUi(isOwner ? 'Owner' : session.role === 'SUPERVISOR' ? 'Supervisor' : 'Team member', session.preferredLanguage)}</p>
          </div>
          <button
            onClick={() => { if (!clockLoading) onClose() }}
            aria-label={translateUi('Close', session.preferredLanguage)}
            className="bf-icon-btn"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Clock In / Out for workers & supervisors */}
        {!isOwner && (
          <div className="px-4 pt-4">
            {onShift ? (
              confirmingClockOut ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { haptic('light'); setConfirmingClockOut(false) }}
                    className="bf-btn bf-btn-secondary bf-btn-lg"
                  >
                    {translateUi('Cancel', session.preferredLanguage)}
                  </button>
                  <button
                    onClick={handleClockOutConfirm}
                    disabled={clockLoading || checking}
                    autoFocus
                    className="bf-btn bf-btn-danger bf-btn-lg"
                  >
                    <StopIcon className="w-4 h-4" />
                    {translateUi(clockLoading ? 'Clocking out…' : 'Confirm', session.preferredLanguage)}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { haptic('light'); setConfirmingClockOut(true) }}
                  className="bf-btn bf-btn-soft-danger bf-btn-lg bf-btn-full"
                >
                  <StopIcon className="w-4 h-4" />
                  {translateUi('Clock Out', session.preferredLanguage)}
                </button>
              )
            ) : (
              <button
                onClick={handleClockIn}
                disabled={clockLoading || checking}
                className="bf-btn bf-btn-success bf-btn-lg bf-btn-full"
              >
                <PlayIcon className="w-4 h-4" />
                {translateUi(clockLoading ? 'Starting…' : 'Clock In', session.preferredLanguage)}
              </button>
            )}
          </div>
        )}

        {/* Link list. Owners use the four-item primary navigation; this sheet
            stays focused on account controls instead of repeating destinations. */}
        {items.length > 0 && <div className="p-3 space-y-1">
          {items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { if (!clockLoading) onClose() }}
                className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl transition-colors ${
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-foreground/90 hover:bg-muted/60'
                }`}
              >
                <item.Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{translateUi(item.label, session.preferredLanguage)}</span>
              </Link>
            )
          })}
        </div>}

        {/* Theme + Logout row */}
        <div className="px-4 pb-4 pt-1 border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Appearance</span>
            {clockError && <p role="alert">{clockError}</p>}
              <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="bf-btn bf-btn-ghost bf-btn-sm"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            {translateUi('Sign Out', session.preferredLanguage)}
          </button>
        </div>
      </div>
    </div>
  )
}
