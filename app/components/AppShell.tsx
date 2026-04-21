import Header from './Header'
import BottomNav from './BottomNav'
import type { Session } from '@/lib/session'

export default function AppShell({
  session,
  organizationName,
  children,
}: {
  session: Session
  organizationName?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background">
      <Header session={session} organizationName={organizationName} />
      {children}
      <BottomNav session={session} />
      {/* Bottom padding for mobile nav */}
      <div className="h-14 sm:h-0" />
    </div>
  )
}