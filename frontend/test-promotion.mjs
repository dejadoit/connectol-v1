import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://acewlqwzbjvjxssdmdlx.supabase.co"; 
const SUPABASE_ANON = "sb_publishable_Svy3R4aMA1T9DoF2_6mkqg_7hdeOgdc"; 

async function run() {
    if (!SUPABASE_ANON) {
        throw new Error("Must set key to run this manual JS test.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

    console.log("== 1. Generating Human Authorization Session ==");
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'jack@dejadoit.com',
        password: 'Walkman1988'
    });
    if (authErr) throw authErr;
    const token = auth.session.access_token;
    console.log("Session acquired.");

    console.log("== 2. Identifying Sandbox Target (Test Project 1) ==");
    const { data: proj } = await supabase.from('projects').select('*').eq('name', 'Test Project 1').single();
    if (!proj) throw new Error("Could not find Test Project 1");

    console.log(`== 3. Ensuring Sandbox Document exists ==`);
    console.log(`Live Link: https://connectol-v1.vercel.app/projects/${proj.id}`);
    let { data: doc } = await supabase.from('canonical_documents').select('*').eq('project_id', proj.id).limit(1).single();
    if (!doc) {
        const insertRes = await supabase.from('canonical_documents').insert({
            project_id: proj.id,
            doc_type: 'guide',
            title: 'Hardening Validation Text',
            content: 'Base line content.',
            version: 1,
            last_updated_by_type: 'user',
            last_updated_by_id: auth.user.id,
            last_updated_by_label: 'Harden Test'
        }).select().single();
        doc = insertRes.data;
    }
    console.log(`Document ID: ${doc.id}`);

    const makeDraft = async (title, content) => {
        const { data } = await supabase.from('workspace_entries').insert({
            project_id: proj.id,
            agent_name: 'human',
            entry_type: 'note',
            title,
            content,
            created_by_type: 'user',
            created_by_id: auth.user.id,
            created_by_label: 'test'
        }).select().single();
        return data.id;
    }

    const promote = async (entryId, mode) => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${proj.id}/promote`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entry_id: entryId,
                target_doc_id: doc.id,
                merge_mode: mode,
                change_summary: `Testing ${mode}`
            }) // I am sending merge_mode directly right now to prove the Edge script accepts it exactly cleanly.
        });
        return res.json();
    }

    console.log("== 4. Pushing Draft 1 & Validating REPLACE ==");
    const draft1Id = await makeDraft("Draft Replace", "THIS IS THE ONLY LINE");
    await promote(draft1Id, "replace");
    const docAfterReplace = await supabase.from('canonical_documents').select('content').eq('id', doc.id).single();
    console.log("Result content after Replace:");
    console.log("---");
    console.log(docAfterReplace.data.content);
    console.log("---\n");

    console.log("== 5. Pushing Draft 2 & Validating APPEND ==");
    const draft2Id = await makeDraft("Draft Append", "THIS IS THE APPENDED LINE");
    await promote(draft2Id, "append");
    const docAfterAppend = await supabase.from('canonical_documents').select('content').eq('id', doc.id).single();
    console.log("Result content after Append:");
    console.log("---");
    console.log(docAfterAppend.data.content);
    console.log("---\n");

    console.log("== 6. Verifying Document Version Tick ==");
    const { data: finalDoc } = await supabase.from('canonical_documents').select('version').eq('id', doc.id).single();
    console.log(`Final logical version: ${finalDoc.version}`);
}

run();
