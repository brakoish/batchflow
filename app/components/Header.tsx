'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  StopIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import ThemeToggle from './ThemeToggle'
import { haptic } from '@/lib/haptic'

type HeaderProps = {
  session: {
    id: string
    name: string
    role: string
  }
}

export default function Header({ session }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [onShift, setOnShift] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const isOwner = session.role === 'OWNER'

  useEffect(() => {
    if (isOwner) return
    // Check shift status
    fetch('/api/shifts')
      .then(r => r.json())
      .then(d => setOnShift(!!d.activeShift))
      .catch(() => {})
  }, [isOwner, pathname])

  const handleLogout = async () => {
    haptic('light')
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/' // hard refresh to clear state
  }

  const handleClockOut = async () => {
    haptic('medium')
    await fetch('/api/shifts', { method: 'PATCH' })
    setOnShift(false)
    window.location.reload()
  }

  const handleClockIn = async () => {
    haptic('medium')
    await fetch('/api/shifts', { method: 'POST' })
    setOnShift(true)
    window.location.reload()
  }

  const navItems = isOwner
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/batches/new', label: 'New Batch' },
        { href: '/history', label: 'History' },
        { href: '/timesheet', label: 'Timesheet' },
        { href: '/recipes', label: 'Recipes' },
        { href: '/workers', label: 'Workers' },
      ]
    : [{ href: '/batches', label: 'Batches' }]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={isOwner ? '/dashboard' : '/batches'} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <div className="w-4 h-4 rounded-md bg-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">BatchFlow</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Clock In/Out button */}
          {!isOwner && (
            onShift ? (
              <button
                onClick={handleClockOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium transition-colors"
              >
                <StopIcon className="w-4 h-4" /> Clock Out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success dark:text-success-foreground text-sm font-medium transition-colors"
              >
                <PlayIcon className="w-4 h-4" /> Clock In
              </button>
            )
          )}

          <span className="hidden sm:block text-sm text-muted-foreground">{session.name}</span>
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {menuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Mobile clock in/out */}
            {!isOwner && (
              onShift ? (
                <button
                  onClick={() => { handleClockOut(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                >
                  <StopIcon className="w-5 h-5" /> Clock Out
                </button>
              ) : (
                <button
                  onClick={() => { handleClockIn(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-success dark:text-success-foreground hover:bg-success/10 transition-colors flex items-center gap-2"
                >
                  <PlayIcon className="w-5 h-5" /> Clock In
                </button>
              )
            )}

            <button
              onClick={() => { handleLogout(); setMenuOpen(false) }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}