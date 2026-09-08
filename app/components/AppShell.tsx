import Header from './Header'
import BottomNav from './BottomNav'
import AnnouncementBar from './AnnouncementBar'
import type { Session } from '@/lib/session'
import EmployeeReminderManager from './EmployeeReminderManager'

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
      <EmployeeReminderManager />
      <div className="sticky top-0 z-40">
        <AnnouncementBar />
        <Header session={session} organizationName={organizationName} />
      </div>
      {children}
      <BottomNav session={session} />
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:h-0" />
    </div>
  )
}
