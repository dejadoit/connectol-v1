import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://acewlqwzbjvjxssdmdlx.supabase.co"; 
const SUPABASE_ANON = "sb_publishable_Svy3R4aMA1T9DoF2_6mkqg_7hdeOgdc"; 

async function run() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: auth } = await supabase.auth.signInWithPassword({ email: 'jack@dejadoit.com', password: 'Walkman1988' });
    const { data: proj } = await supabase.from('projects').select('*').eq('name', 'Test Project 1').single();
    
    // Draft Subagent Replace
    await supabase.from('workspace_entries').insert({
        project_id: proj.id, agent_name: 'human', entry_type: 'note',
        title: 'Draft Subagent Replace', content: 'REPLACE CONTENT',
        created_by_type: 'user', created_by_id: auth.user.id, created_by_label: 'test'
    });

    // Draft Subagent Append
    await supabase.from('workspace_entries').insert({
        project_id: proj.id, agent_name: 'human', entry_type: 'note',
        title: 'Draft Subagent Append', content: 'APPEND CONTENT',
        created_by_type: 'user', created_by_id: auth.user.id, created_by_label: 'test'
    });
    console.log("Seed complete.");
}
run();
