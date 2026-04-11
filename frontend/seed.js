// seed.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://acewlqwzbjvjxssdmdlx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Please export SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runSeed() {
  console.log("Seeding Database via Service Role...");
  
  // Create Owner User via Auth Admin
  const { data: userData, error: authError } = await supabase.auth.admin.createUser({
    email: 'operator@connectol.test',
    password: 'securepassword123',
    email_confirm: true
  });
  if (authError && !authError.message.includes('already registered')) {
    console.error("Auth Error:", authError);
    return;
  }
  
  // If user already existed, fetch them
  let ownerId;
  let ownerEmail_alias = 'operator';
  if (userData?.user) {
    ownerId = userData.user.id;
  } else {
    // Lookup user
    const { data: users, error: listUserErr } = await supabase.auth.admin.listUsers();
    const existing = users.users.find(u => u.email === 'operator@connectol.test');
    if (existing) {
       ownerId = existing.id;
    } else {
       console.error("Failed to find/create owner user");
       return;
    }
  }

  // 1. Create Organisation
  const { data: org, error: orgErr } = await supabase.from('organisations').insert({
    name: 'Test Org',
    slug: 'test-org-1',
    owner_id: ownerId
  }).select().single();
  
  let targetOrg = org;
  if (orgErr) {
    if (orgErr.code !== '23505') { // If not a unique violation
       console.error("Org Error:", orgErr); return;
    }
    const { data } = await supabase.from('organisations').select().eq('slug', 'test-org-1').single();
    targetOrg = data;
  }

  // 2. Create Project
  const { data: project, error: projErr } = await supabase.from('projects').insert({
    org_id: targetOrg.id,
    name: 'LOWEND V2 Platform',
    description: 'Membership rewrite context and agent tests',
    status: 'active',
    priority: 'high',
    repo_url: 'https://github.com/jack/lowend-v2'
  }).select().single();

  if (projErr) {
      console.error("Project Error:", projErr); return;
  }

  // 3. Create canonical docs
  await supabase.from('canonical_documents').insert([
    {
      project_id: project.id,
      doc_type: 'current_state',
      title: 'Current State: LOWEND V2',
      content: '# LOWEND V2\n\nThe project is currently shifting from Next.js Pages router to App Router.',
      summary: 'Migrating legacy platform to standard App Router.',
      version: 1,
      last_updated_by_type: 'user',
      last_updated_by_id: ownerId,
      last_updated_by_label: ownerEmail_alias
    },
    {
      project_id: project.id,
      doc_type: 'architecture',
      title: 'V2 Architecture',
      content: 'We use Tailwind, Supabase, and connect to physical OBS streams.',
      summary: 'Tech stack definitions.',
      version: 1,
      last_updated_by_type: 'user',
      last_updated_by_id: ownerId,
      last_updated_by_label: ownerEmail_alias
    }
  ]);

  // 4. Workspace Entries (Agents)
  await supabase.from('workspace_entries').insert([
    {
      project_id: project.id,
      agent_name: 'claude',
      entry_type: 'suggestion',
      title: 'Use Server Actions for Mutations',
      content: 'I recommend we drop API routes and stick to pure Server Actions for form submissions. It cuts down on network hook overhead.',
      status: 'active',
      confidence: 'high',
      created_by_type: 'agent',
      created_by_id: ownerId, // Mock ID for agent placeholder
      created_by_label: 'Claude 3.5 Sonnet'
    },
    {
      project_id: project.id,
      agent_name: 'jj',
      entry_type: 'experiment',
      title: 'OBS Connection Testing',
      content: 'Hooking up the OBS relay on port 3000 mapping against 127.0.0.1.',
      status: 'active',
      confidence: 'medium',
      created_by_type: 'agent',
      created_by_id: ownerId,
      created_by_label: 'JJ Local Proxy'
    },
    {  // Soft-deleted entry
      project_id: project.id,
      agent_name: 'chatgpt',
      entry_type: 'draft',
      title: 'Legacy API Draft',
      content: 'Old notes on maintaining API routes.',
      status: 'archived',
      confidence: 'low',
      created_by_type: 'agent',
      created_by_id: ownerId,
      created_by_label: 'ChatGPT 4',
      deleted_at: new Date().toISOString()
    }
  ]);

  console.log("Seed complete. Target Project ID:", project.id);
}

runSeed();
