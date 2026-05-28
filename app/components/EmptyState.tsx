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
    <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 px-6 text-center">
      <Icon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="bf-btn bf-btn-success bf-btn-sm mt-4"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
