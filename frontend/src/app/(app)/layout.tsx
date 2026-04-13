import SignOutButton from '@/components/SignOutButton';
import ProjectSwitcher from '@/components/ProjectSwitcher';
import { createClient } from '@/utils/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: projects } = await supabase.from('projects').select('id, name');

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#5f5e5e] font-sans antialiased flex flex-col">
       <header className="flex h-14 items-center justify-between bg-white border-b px-6">
          <div className="flex items-center gap-4">
            <div className="font-bold text-lg tracking-tight">connectol.</div>
            <ProjectSwitcher projects={projects || []} />
          </div>
          <div className="flex items-center gap-6">
            <a href="/settings" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Settings</a>
            <SignOutButton />
          </div>
       </header>
       <main className="flex-1 overflow-auto">
          {children}
       </main>
    </div>
  )
}
