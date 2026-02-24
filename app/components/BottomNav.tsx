'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  PlusCircleIcon,
  ClockIcon,
  BeakerIcon,
  UsersIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  ClockIcon as ClockIconSolid,
  BeakerIcon as BeakerIconSolid,
  UsersIcon as UsersIconSolid,
  QueueListIcon as QueueListIconSolid,
} from '@heroicons/react/24/solid'

type Props = { role: string }

export default function BottomNav({ role }: Props) {
  const pathname = usePathname()

  const ownerItems = [
    { href: '/dashboard', label: 'Home', Icon: HomeIcon, IconActive: HomeIconSolid },
    { href: '/batches/new', label: 'New', Icon: PlusCircleIcon, IconActive: PlusCircleIconSolid },
    { href: '/history', label: 'History', Icon: ClockIcon, IconActive: ClockIconSolid },
    { href: '/recipes', label: 'Recipes', Icon: BeakerIcon, IconActive: BeakerIconSolid },
    { href: '/workers', label: 'Team', Icon: UsersIcon, IconActive: UsersIconSolid },
  ]

  const workerItems = [
    { href: '/batches', label: 'Batches', Icon: QueueListIcon, IconActive: QueueListIconSolid },
  ]

  const items = role === 'OWNER' ? ownerItems : workerItems

  // Don't show for workers (only 1 item)
  if (items.length <= 1) return null

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/50 safe-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = active ? item.IconActive : item.Icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                active ? 'text-emerald-400' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
