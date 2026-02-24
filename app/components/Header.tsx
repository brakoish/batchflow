'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  StopIcon,
} from '@heroicons/react/24/outline'

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
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
      <div className="max-w-5xl mx-auto px-4 h-13 flex items-center justify-between">
        {/* Logo */}
        <Link href={isOwner ? '/dashboard' : '/batches'} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-emerald-300" />
          </div>
          <span className="text-sm font-semibold text-zinc-50 tracking-tight">BatchFlow</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Clock Out button if on shift */}
          {!isOwner && onShift && (
            <button
              onClick={handleClockOut}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium transition-colors"
            >
              <StopIcon className="w-3.5 h-3.5" /> Clock Out
            </button>
          )}

          <span className="hidden sm:block text-xs text-zinc-500">{session.name}</span>
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-zinc-900"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            {menuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-zinc-800/50 bg-zinc-950/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Mobile clock out */}
            {!isOwner && onShift && (
              <button
                onClick={() => { handleClockOut(); setMenuOpen(false) }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
              >
                <StopIcon className="w-4 h-4" /> Clock Out
              </button>
            )}

            <button
              onClick={() => { handleLogout(); setMenuOpen(false) }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}