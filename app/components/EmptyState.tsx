import { InboxIcon, ClipboardDocumentListIcon, UsersIcon, ClockIcon, BeakerIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

const icons: Record<string, any> = {
  inbox: InboxIcon,
  clipboard: ClipboardDocumentListIcon,
  users: UsersIcon,
  clock: ClockIcon,
  beaker: BeakerIcon,
}

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}) {
  const Icon = icons[icon] || InboxIcon

  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-12 px-6 text-center">
      <Icon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="text-xs text-zinc-600 mt-1">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-xs font-medium transition-all"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
