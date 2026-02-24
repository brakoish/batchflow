'use client'

import Link from 'next/link'
import { useState } from 'react'

type Session = {
  id: string
  name: string
  role: string
}

export default function Header({ session }: { session: Session }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const isOwner = session.role === 'OWNER'

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <header className="bg-zinc-900 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href={isOwner ? '/dashboard' : '/batches'} className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">BatchFlow</h1>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {isOwner ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/batches"
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
                >
                  Batches
                </Link>
                <Link
                  href="/recipes"
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
                >
                  Recipes
                </Link>
                <Link
                  href="/workers"
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
                >
                  Workers
                </Link>
                <Link
                  href="/batches/new"
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
                >
                  New Batch
                </Link>
              </>
            ) : (
              <Link
                href="/batches"
                className="px-3 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
              >
                Batches
              </Link>
            )}

            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-zinc-700">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{session.name}</p>
                <p className="text-xs text-zinc-400">
                  {isOwner ? 'Owner' : 'Worker'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium border border-zinc-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-2"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-zinc-800">
            <div className="flex flex-col gap-2">
              <div className="mb-3 pb-3 border-b border-zinc-800">
                <p className="text-sm font-medium text-white">{session.name}</p>
                <p className="text-xs text-zinc-400">
                  {isOwner ? 'Owner' : 'Worker'}
                </p>
              </div>

              {isOwner ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/batches"
                    className="px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Batches
                  </Link>
                  <Link
                    href="/recipes"
                    className="px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Recipes
                  </Link>
                  <Link
                    href="/workers"
                    className="px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Workers
                  </Link>
                  <Link
                    href="/batches/new"
                    className="px-3 py-2 mt-2 text-center rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    New Batch
                  </Link>
                </>
              ) : (
                <Link
                  href="/batches"
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Batches
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="mt-3 px-3 py-2 text-left rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium border border-zinc-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
