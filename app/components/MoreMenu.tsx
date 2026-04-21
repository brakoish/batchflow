'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  StopIcon,
  PlayIcon,
  ClockIcon,
  ChartBarIcon,
  BeakerIcon,
  UsersIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
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
        .catch(() => {})
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

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleClockIn = async () => {
    haptic('medium')
    setClockLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'POST' })
      if (res.ok) {
        setOnShift(true)
        window.dispatchEvent(new Event('shift-changed'))
        onClose()
      }
    } catch {}
    setClockLoading(false)
  }

  const handleClockOutConfirm = async () => {
    haptic('medium')
    setClockLoading(true)
    try {
      const res = await fetch('/api/shifts', { method: 'PATCH' })
      if (res.ok) {
        setOnShift(false)
        setConfirmingClockOut(false)
        window.dispatchEvent(new Event('shift-changed'))
        onClose()
      }
    } catch {}
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
    ? [
        { href: '/timesheet', label: 'Timesheets', Icon: ClockIcon },
        { href: '/recipes', label: 'Recipes', Icon: BeakerIcon },
        { href: '/history', label: 'Reports', Icon: DocumentTextIcon },
        { href: '/workers', label: 'Team', Icon: UsersIcon },
        { href: '/org/invite', label: 'Org settings', Icon: BuildingOffice2Icon },
      ]
    : [
        { href: '/workers/me/timesheet', label: 'My timesheet', Icon: ClockIcon },
        { href: '/workers/me', label: 'My Day', Icon: ChartBarIcon },
      ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="More options"
    >
      <div
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
            <p className="text-[11px] text-muted-foreground">{isOwner ? 'Owner' : session.role === 'SUPERVISOR' ? 'Supervisor' : 'Team member'}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
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
                    className="min-h-[52px] rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 active:scale-[0.97] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClockOutConfirm}
                    disabled={clockLoading}
                    autoFocus
                    className="min-h-[52px] rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 active:scale-[0.97] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <StopIcon className="w-4 h-4" />
                    {clockLoading ? 'Clocking out…' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { haptic('light'); setConfirmingClockOut(true) }}
                  className="w-full min-h-[52px] rounded-xl bg-destructive-subtle text-destructive text-sm font-semibold hover:bg-destructive hover:text-destructive-foreground active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <StopIcon className="w-4 h-4" />
                  Clock Out
                </button>
              )
            ) : (
              <button
                onClick={handleClockIn}
                disabled={clockLoading}
                className="w-full min-h-[52px] rounded-xl bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-4 h-4" />
                {clockLoading ? 'Starting…' : 'Clock In'}
              </button>
            )}
          </div>
        )}

        {/* Link list */}
        <div className="p-3 space-y-1">
          {items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 min-h-[48px] px-3 rounded-xl transition-colors ${
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-foreground/90 hover:bg-muted/60'
                }`}
              >
                <item.Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Theme + Logout row */}
        <div className="px-4 pb-4 pt-1 border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="min-h-[44px] px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
