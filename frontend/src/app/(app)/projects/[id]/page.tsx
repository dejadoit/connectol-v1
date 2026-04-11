import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import ProjectClient from './ProjectClient';

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const [projectRes, docsRes, workspaceRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', params.id).single(),
    supabase.from('canonical_documents').select('*').eq('project_id', params.id),
    supabase.from('workspace_entries')
      .select('*')
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  if (!projectRes.data) {
    notFound();
  }

  // Deterministic sorting per exact locked spec request
  const DOC_ORDER = ['current_state', 'architecture', 'decisions', 'tasks', 'blockers', 'handoff', 'changelog', 'known_issues', 'custom'];
  
  const rawDocs = docsRes.data || [];
  
  // Safe array clone before sorting natively resolving multiple "custom" layers
  const sortedDocs = [...rawDocs].sort((a, b) => {
     let iA = DOC_ORDER.indexOf(a.doc_type);
     let iB = DOC_ORDER.indexOf(b.doc_type);
     
     // Route unknown types safely to the back
     if (iA === -1) iA = 999;
     if (iB === -1) iB = 999;

     if (iA !== iB) return iA - iB;
     
     // Fallback parameter for custom/identical ties targeting `updated_at` desc
     return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <ProjectClient 
       project={projectRes.data} 
       docs={sortedDocs} 
       workspaceEntries={workspaceRes.data || []} 
    />
  );
}
