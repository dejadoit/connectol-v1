import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import KeysClient from './KeysClient';

export default async function KeysPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  // Validate Project auth boundary using RLS implicitly
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).single();

  if (!project) {
    notFound();
  }

  // Fetch all keys mapped under the organization structure
  const { data: keysRes } = await supabase
    .from('api_keys')
    .select('*')
    .eq('org_id', project.org_id)
    .order('created_at', { ascending: false });

  // Safety filter isolating keys that are scoped either globally or explicitly bound to this project ID
  const activeKeys = (keysRes || []).filter(k => 
     !k.allowed_project_ids || k.allowed_project_ids.length === 0 || k.allowed_project_ids.includes(project.id)
  );

  return <KeysClient project={project} initialKeys={activeKeys} />;
}
