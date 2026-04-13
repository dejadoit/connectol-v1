'use server'

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function createPat(payload: { org_id: string, user_id: string, name: string }) {
  const supabase = await createClient();
  
  // Verify auth explicitly via server context
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  // A Personal Access Token maps explicitly to the verified human issuing the request
  if (user.id !== payload.user_id) throw new Error("Token issuance mismatch");

  // Generate 256-bit cryptographically secure raw token
  const rawKeyString = `ct_${crypto.randomBytes(32).toString('hex')}`;
  
  // Create secure one-way SHA-256 hash for database storage
  const keyHash = crypto.createHash('sha256').update(rawKeyString).digest('hex');

  const insertPayload = {
    org_id: payload.org_id,
    name: payload.name,
    agent_name: `PAT:${user.id}`, // We embed the user ID here to identify it as a 'Personal' key without requiring a database migration
    key_hash: keyHash,
    allowed_project_ids: [], // Empty array natively forces Supabase Edge scripts to fall back to generic Org-Level querying
    can_read_canonical: true,
    can_read_workspace: true,
    can_write_workspace: true,
    can_promote: false // Disallow atomic truth overwrite for PATs by default to force human review via UI
  };

  const { data, error } = await supabase.from('api_keys').insert(insertPayload).select().single();
  if (error) throw new Error(error.message);

  // Return the raw key strictly ONCE to the client memory
  return { keyRecord: data, rawKey: rawKeyString };
}
