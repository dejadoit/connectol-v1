import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = "https://acewlqwzbjvjxssdmdlx.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
   // 1. Setup API Key using explicit Server Action logic natively
   const rawKeyString = `ct_${crypto.randomBytes(32).toString('hex')}`;
   const keyHash = crypto.createHash('sha256').update(rawKeyString).digest('hex');

   const { data: orgData } = await supabase.from('organisations').select('id').limit(1).single();
   const { data: projData } = await supabase.from('projects').select('id').eq('org_id', orgData.id).limit(1).single();

   const insertPayload = {
      org_id: orgData.id,
      name: "LIVE HTTP AUTHENTICATOR",
      agent_name: "http-agent-live",
      key_hash: keyHash,
      allowed_project_ids: [projData.id],
      can_read_canonical: true,
      can_read_workspace: true,
      can_write_workspace: true,
      can_promote: false
   };

   const { data: apiKeyRecord, error: insertErr } = await supabase.from('api_keys').insert(insertPayload).select().single();
   if (insertErr) throw new Error("API Key Creation failed: " + insertErr.message);

   console.log("=== API KEY LOCALLY GENERATED ===");
   console.log("String for Authorization Header:", rawKeyString);

   const endpoint_base = `${SUPABASE_URL}/functions/v1/connectol/projects/${projData.id}`;
   const headers = { 'Authorization': `Bearer ${rawKeyString}`, 'Content-Type': 'application/json' };

   // 2. GET /projects/:id/context
   console.log(`\n\n=== VERIFICATION 1: GET /context ===`);
   const ctx1Res = await fetch(`${endpoint_base}/context`, { method: 'GET', headers });
   console.log("STATUS:", ctx1Res.status);
   console.log("RAW BODY:\n" + await ctx1Res.text());

   // 3. GET /projects/:id/context?compact=true
   console.log(`\n\n=== VERIFICATION 2: GET /context?compact=true ===`);
   const ctx2Res = await fetch(`${endpoint_base}/context?compact=true`, { method: 'GET', headers });
   console.log("STATUS:", ctx2Res.status);
   console.log("RAW BODY:\n" + await ctx2Res.text());

   // 4. POST /projects/:id/workspace
   console.log(`\n\n=== VERIFICATION 3: POST /workspace ===`);
   const wsPayload = {
       entry_type: 'experiment',
       title: 'Live Endpoint Injection',
       content: 'Successfully executed via live edge HTTP layer mapping token hashes!',
       confidence: 'high'
   };
   const wsRes = await fetch(`${endpoint_base}/workspace`, { method: 'POST', headers, body: JSON.stringify(wsPayload) });
   console.log("STATUS:", wsRes.status);
   console.log("RAW BODY:\n" + await wsRes.text());

   // 5. Confirm Workspace UI Appearance (DB Check)
   const { data: wsEntries } = await supabase.from("workspace_entries").select("*").eq("project_id", projData.id).eq("title", 'Live Endpoint Injection');
   console.log("\n\n=== VERIFICATION 4: DB Confirm Entry Inserted ===");
   console.log("Exists in main stream:", wsEntries.length > 0);

   // 6. Revoke token
   await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", apiKeyRecord.id);
   console.log("\n\n=== ACTION: Key Revoked ===");
   
   // 7. GET /context using REVOKED key
   console.log(`\n\n=== VERIFICATION 5: Edge Validation on Revoke ===`);
   const rejectRes = await fetch(`${endpoint_base}/context`, { method: 'GET', headers });
   console.log("STATUS:", rejectRes.status);
   console.log("RAW BODY:\n" + await rejectRes.text());

}

runTest().catch(console.error);
