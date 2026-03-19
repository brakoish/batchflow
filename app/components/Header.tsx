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
import { Session } from 'next-auth'

type HeaderProps = {
  session: Session
  organizationName?: string
}

export default function Header({ session, organizationName }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [onShift, setOnShift] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const isOwner = session.user.role === 'OWNER'

  useEffect(() => {
    if (isOwner) return
    const checkShift = () => {
      fetch('/api/shifts')
        .then(r => r.json())
        .then(d => setOnShift(!!d.activeShift))
        .catch(() => {})
    }
    checkShift()
    // Listen for clock-in/out events from other components
    window.addEventListener('shift-changed', checkShift)
    return () => window.removeEventListener('shift-changed', checkShift)
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
        { href: '/workers', label: 'Workers' },
        { href: '/org/invite', label: 'Org' },
      ]
    : [{ href: '/batches', label: 'Batches' }]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href={isOwner ? '/dashboard' : '/batches'} className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-7 h-7 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="6"/>
            <rect x="12" y="56" width="32" height="32" rx="6"/>
            <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
          </svg>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-foreground leading-none">BatchFlow</span>
            {organizationName && (
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{organizationName}</span>
            )}
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                isActive(item.href)
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-destructive-subtle text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-150"
              >
                <StopIcon className="w-4 h-4" /> Clock Out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-success-subtle text-success hover:bg-success hover:text-success-foreground transition-all duration-150"
              >
                <PlayIcon className="w-4 h-4" /> Clock In
              </button>
            )
          )}

          <span className="hidden sm:block text-sm text-muted-foreground">{session.user.name}</span>
          
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 text-foreground rounded-md hover:bg-muted transition-colors"
          >
            {menuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-background">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {!isOwner && (
              onShift ? (
                <button
                  onClick={() => { handleClockOut(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium rounded-md bg-destructive-subtle text-destructive flex items-center gap-2"
                >
                  <StopIcon className="w-4 h-4" /> Clock Out
                </button>
              ) : (
                <button
                  onClick={() => { handleClockIn(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium rounded-md bg-success-subtle text-success flex items-center gap-2"
                >
                  <PlayIcon className="w-4 h-4" /> Clock In
                </button>
              )
            )}

            <button
              onClick={() => { handleLogout(); setMenuOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}