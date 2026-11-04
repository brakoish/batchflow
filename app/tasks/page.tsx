import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppShell from '@/app/components/AppShell'
import DirectedTasks from '@/app/components/DirectedTasks'
export default async function TasksPage() {
 const session = await getSession()
 if (!session) redirect('/')
 if (!['OWNER','SUPERVISOR'].includes(session.role)) redirect('/workers/me')
 return <AppShell session={session}><main className="max-w-5xl mx-auto p-4"><h1 className="text-2xl font-bold mb-4">Plan team work</h1><DirectedTasks manage/></main></AppShell>
}
