import Header from './Header'
import BottomNav from './BottomNav'
import { Session } from 'next-auth'

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
      <BottomNav role={session.user?.role || 'WORKER'} />
      {/* Bottom padding for mobile nav */}
      <div className="h-14 sm:h-0" />
    </div>
  )
}