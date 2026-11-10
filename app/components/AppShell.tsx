import DirectedTasks from './DirectedTasks'
import Link from 'next/link'
import Header from './Header'
import BottomNav from './BottomNav'
import AnnouncementBar from './AnnouncementBar'
import type { Session } from '@/lib/session'
import EmployeeReminderManager from './EmployeeReminderManager'
import UiTranslation from './UiTranslation'

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
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-card focus:p-4">Skip to main content</a>
      <UiTranslation language={session.preferredLanguage} />
      <EmployeeReminderManager />
      <div className="sticky top-0 z-40">
        <AnnouncementBar />
        <Header session={session} organizationName={organizationName} />
        <div className="px-4 py-2 bg-background flex justify-end">{['OWNER','SUPERVISOR'].includes(session.role) ? <Link href="/tasks" className="text-sm font-semibold px-3 py-2 rounded-xl bg-card border border-border">Plan work</Link> : <DirectedTasks badge />}</div>
      </div>
      <div id="main-content" tabIndex={-1}>{children}</div>
      <BottomNav session={session} />
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:h-0" />
    </div>
  )
}
