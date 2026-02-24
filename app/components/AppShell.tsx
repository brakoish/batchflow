import Header from './Header'
import BottomNav from './BottomNav'

type Session = { id: string; name: string; role: string }

export default function AppShell({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-zinc-950">
      <Header session={session} />
      {children}
      <BottomNav role={session.role} />
      {/* Bottom padding for mobile nav */}
      <div className="h-14 sm:h-0" />
    </div>
  )
}
