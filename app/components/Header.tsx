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
    fetch('/api/shifts')
      .then(r => r.json())
      .then(d => setOnShift(!!d.activeShift))
      .catch(() => {})
  }, [isOwner, pathname])

  const handleLogout = async () => {
    haptic('light')
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
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
        { href: '/workers', label: 'Team' },
      ]
    : [{ href: '/batches', label: 'Batches' }]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={isOwner ? '/dashboard' : '/batches'} className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-7 h-7 text-foreground" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="8" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="8"/>
            <rect x="12" y="56" width="32" height="32" rx="8"/>
            <path d="M64 56h16a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8V64a8 8 0 0 1 8-8z"/>
            <path d="M72 72h8" strokeWidth="3"/>
          </svg>
          <span className="text-base font-semibold text-foreground tracking-tight">BatchFlow</span>
        </Link>

        {/* Desktop Nav - Skinny rounded pills */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-all ${
                isActive(item.href)
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-foreground border-border hover:border-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {!isOwner && (
            onShift ? (
              <button
                onClick={handleClockOut}
                className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
              >
                <StopIcon className="w-4 h-4" /> Out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full border border-success text-success hover:bg-success hover:text-success-foreground transition-all"
              >
                <PlayIcon className="w-4 h-4" /> In
              </button>
            )
          )}

          <span className="hidden sm:block text-sm font-medium text-muted-foreground">{session.name}</span>
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center p-2 text-foreground hover:text-muted-foreground transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 text-foreground"
          >
            {menuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu - Rounded cards */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-background">
          <div className="px-4 py-3 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 text-base font-medium rounded-xl border ${
                  isActive(item.href)
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-foreground border-border'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {!isOwner && (
              onShift ? (
                <button
                  onClick={() => { handleClockOut(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-base font-medium rounded-xl border border-destructive text-destructive flex items-center gap-2"
                >
                  <StopIcon className="w-5 h-5" /> Clock Out
                </button>
              ) : (
                <button
                  onClick={() => { handleClockIn(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-3 text-base font-medium rounded-xl border border-success text-success flex items-center gap-2"
                >
                  <PlayIcon className="w-5 h-5" /> Clock In
                </button>
              )
            )}

            <button
              onClick={() => { handleLogout(); setMenuOpen(false) }}
              className="w-full text-left px-4 py-3 text-base font-medium rounded-xl border border-border text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}