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
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/' // hard refresh to clear state
  }

  const handleClockOut = async () => {
    await fetch('/api/shifts', { method: 'PATCH' })
    setOnShift(false)
    window.location.reload()
  }

  const handleClockIn = async () => {
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
      <div className="max-w-5xl mx-auto px-4 h-13 flex items-center justify-between">
        {/* Logo */}
        <Link href={isOwner ? '/dashboard' : '/batches'} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-emerald-300" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">BatchFlow</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium transition-colors"
              >
                <StopIcon className="w-3.5 h-3.5" /> Clock Out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-medium transition-colors"
              >
                <PlayIcon className="w-3.5 h-3.5" /> Clock In
              </button>
            )
          )}

          <span className="hidden sm:block text-xs text-muted-foreground">{session.name}</span>
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {menuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
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
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <StopIcon className="w-4 h-4" /> Clock Out
                </button>
              ) : (
                <button
                  onClick={() => { handleClockIn(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
                >
                  <PlayIcon className="w-4 h-4" /> Clock In
                </button>
              )
            )}

            <button
              onClick={() => { handleLogout(); setMenuOpen(false) }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}