'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  PlusCircleIcon,
  ClockIcon,
  BeakerIcon,
  UsersIcon,
  QueueListIcon,
  ChartBarIcon,
  EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  ClockIcon as ClockIconSolid,
  BeakerIcon as BeakerIconSolid,
  UsersIcon as UsersIconSolid,
  QueueListIcon as QueueListIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  EllipsisHorizontalCircleIcon as EllipsisHorizontalCircleIconSolid,
} from '@heroicons/react/24/solid'
import MoreMenu from './MoreMenu'
import { haptic } from '@/lib/haptic'
import type { Session } from '@/lib/session'

type Props = { session: Session }

export default function BottomNav({ session }: Props) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const role = session.role

  // Role-based primary destinations. Secondary destinations (Recipes for
  // supervisors, Org settings, etc.) live in the More sheet.
  const ownerItems = [
    { href: '/dashboard', label: 'Home', Icon: HomeIcon, IconActive: HomeIconSolid },
    { href: '/batches/new', label: 'New', Icon: PlusCircleIcon, IconActive: PlusCircleIconSolid },
    { href: '/history', label: 'Reports', Icon: ClockIcon, IconActive: ClockIconSolid },
    { href: '/workers', label: 'Team', Icon: UsersIcon, IconActive: UsersIconSolid },
  ]

  const supervisorItems = [
    { href: '/batches', label: 'Batches', Icon: QueueListIcon, IconActive: QueueListIconSolid },
    { href: '/batches/new', label: 'New', Icon: PlusCircleIcon, IconActive: PlusCircleIconSolid },
    { href: '/shift', label: 'Shift', Icon: ClockIcon, IconActive: ClockIconSolid },
    { href: '/workers/me', label: 'My Day', Icon: ChartBarIcon, IconActive: ChartBarIconSolid },
  ]

  const workerItems = [
    { href: '/batches', label: 'Batches', Icon: QueueListIcon, IconActive: QueueListIconSolid },
    { href: '/shift', label: 'Shift', Icon: ClockIcon, IconActive: ClockIconSolid },
    { href: '/workers/me', label: 'My Day', Icon: ChartBarIcon, IconActive: ChartBarIconSolid },
  ]

  const items = role === 'OWNER' ? ownerItems : role === 'SUPERVISOR' ? supervisorItems : workerItems

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 safe-bottom">
        <div className="flex items-center justify-around h-14">
          {items.map((item) => {
            const active = isActive(item.href)
            const Icon = active ? item.IconActive : item.Icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                  active ? 'text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => { haptic('light'); setMoreOpen(true) }}
            aria-label="More options"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
              moreOpen ? 'text-emerald-500' : 'text-muted-foreground'
            }`}
          >
            {moreOpen ? (
              <EllipsisHorizontalCircleIconSolid className="w-5 h-5" />
            ) : (
              <EllipsisHorizontalCircleIcon className="w-5 h-5" />
            )}
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <MoreMenu session={session} open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
