'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

const DOC_ORDER = [
  'current_state', 
  'architecture', 
  'decisions', 
  'tasks', 
  'blockers', 
  'handoff', 
  'changelog', 
  'known_issues'
];

const DEFAULT_DOCS: Record<string, string> = {
  current_state: "# Current State\n\nOutline the current status of your project here.",
  architecture: "# Architecture\n\nDefine your technical architecture and stack here.",
  decisions: "# Decisions\n\nLog important engineering and design decisions.",
  tasks: "# Tasks\n\nActive tasks that need operator or agent attention.",
  blockers: "# Blockers\n\nList anything explicitly blocking progress.",
  handoff: "# Handoff Notes\n\nContext required to resume work smoothly tomorrow.",
  changelog: "# Changelog\n\nA running list of shipped modifications.",
  known_issues: "# Known Issues\n\nBugs or flaws currently tracked in the system."
};

export async function createProjectAction(data: { name: string, description?: string, priority: string, repo_url?: string }) {
  const supabase = await createClient();

  // 1. Get Session
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error("Unauthorized");

  // 2. Fetch User's Default Organization
  const { data: orgData, error: orgErr } = await supabase.from('organisations')
    .select('id')
    .eq('owner_id', session.user.id)
    .limit(1)
    .single();

  if (orgErr || !orgData) {
    throw new Error("Unable to locate a matching organization for this user.");
  }

  // 3. Create the Project
  const { data: newProject, error: projectErr } = await supabase.from('projects').insert({
    org_id: orgData.id,
    name: data.name,
    description: data.description || '',
    priority: data.priority,
    repo_url: data.repo_url || '',
    status: 'active'
  }).select().single();

  if (projectErr || !newProject) {
     throw new Error(projectErr?.message || "Failed to create project");
  }

  // 4. Seed Canonical Documents
  const scaffoldDocs = DOC_ORDER.map(type => ({
      project_id: newProject.id,
      doc_type: type,
      title: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      content: DEFAULT_DOCS[type],
      summary: `Initial ${type} scaffold.`,
      version: 1,
      last_updated_by_type: 'user',
      last_updated_by_id: session.user.id,
      last_updated_by_label: session.user.email || 'System'
  }));

  const { error: seedErr } = await supabase.from('canonical_documents').insert(scaffoldDocs);
  if (seedErr) {
     console.error("Warning: Failed to seed complete scaffold", seedErr);
     // Still return project since the primary asset is alive
  }

  revalidatePath('/');
  
  return { success: true, projectId: newProject.id };
}
