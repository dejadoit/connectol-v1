import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://acewlqwzbjvjxssdmdlx.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
   const rawKeyString = `ct_${crypto.randomBytes(32).toString('hex')}`;
   const keyHash = crypto.createHash('sha256').update(rawKeyString).digest('hex');

   const { data: orgData } = await supabase.from('organisations').select('id').limit(1).single();
   const { data: projData } = await supabase.from('projects').select('id, name').eq('org_id', orgData.id).limit(1).single();

   const insertPayload = {
      org_id: orgData.id,
      name: "Extension Prove Auth",
      agent_name: "ext-bot-xyz",
      key_hash: keyHash,
      allowed_project_ids: null, // all projects
      can_read_canonical: true,
      can_read_workspace: true,
      can_write_workspace: true,
      can_promote: false
   };

   await supabase.from('api_keys').insert(insertPayload);
   console.log("=== PROOF KEY GENERATED ===");
   console.log("BASE_URL: https://acewlqwzbjvjxssdmdlx.supabase.co/functions/v1/connectol");
   console.log("KEY: " + rawKeyString);
   console.log("AVAILABLE_PROJECT: " + projData.id + " (" + projData.name + ")");
}
run();
