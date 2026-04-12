import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

import EmptyDashboard from '@/components/EmptyDashboard';

export default async function AppDashboard() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from('projects').select('*');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-[#5f5e5e]">Connectol Workspace</h1>
      <div className="grid gap-4">
        {(!projects || projects.length === 0) && <EmptyDashboard />}
        {projects?.map(p => (
           <Link key={p.id} href={`/projects/${p.id}`} className="block p-5 bg-white border rounded shadow-sm hover:border-[#466370]">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-xl font-bold text-[#466370]">{p.name}</h2>
                <div className="text-xs uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded font-semibold text-gray-500">{p.status}</div>
              </div>
              <p className="text-sm text-gray-500">{p.description}</p>
           </Link>
        ))}
      </div>
    </div>
  );
}
