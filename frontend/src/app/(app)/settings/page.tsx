import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import PatClient from './PatClient';

export default async function SettingsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch the user's organization explicitly (assuming they belong to one or we get it from their first project)
  // But wait, the existing createApiKey requires `org_id`.
  // Let's get the user's org_id. If a user exists, we can fetch their projects to find org_id.
  const { data: projects } = await supabase.from('projects').select('org_id').limit(1).single();
  const orgId = projects?.org_id || null;

  // Retrieve existing personal access tokens bound to the authenticated user
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, agent_name, revoked_at, last_used_at, key_hash')
    .ilike('agent_name', `PAT:${user.id}%`)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] min-h-[calc(100vh-3.5rem)]">
      <div className="bg-white px-8 py-8 border-b shrink-0 flex items-center justify-between">
         <div className="max-w-5xl w-full mx-auto">
           <h1 className="text-3xl font-bold text-[#5f5e5e] mb-2 tracking-tight">Account Settings</h1>
           <p className="text-gray-500">Manage your global Connectol configurations and API credentials.</p>
         </div>
      </div>
      
      <div className="p-8 w-full max-w-5xl mx-auto flex-1">
         <PatClient initialKeys={keys || []} userId={user.id} orgId={orgId} />
      </div>
    </div>
  );
}
