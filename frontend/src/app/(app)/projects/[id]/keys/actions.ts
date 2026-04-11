'use server'

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function createApiKey(payload: { org_id: string, name: string, agent_name: string, allowed_project_ids: string[], can_promote: boolean }) {
  const supabase = await createClient();
  
  // Verify auth explicitly via server context
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  // Generate 256-bit cryptographically secure raw token
  const rawKeyString = `ct_${crypto.randomBytes(32).toString('hex')}`;
  
  // Create secure one-way SHA-256 hash
  const keyHash = crypto.createHash('sha256').update(rawKeyString).digest('hex');

  const insertPayload = {
    org_id: payload.org_id,
    name: payload.name,
    agent_name: payload.agent_name,
    key_hash: keyHash,
    allowed_project_ids: payload.allowed_project_ids,
    can_read_canonical: true,
    can_read_workspace: true,
    can_write_workspace: true,
    can_promote: payload.can_promote
  };

  const { data, error } = await supabase.from('api_keys').insert(insertPayload).select().single();
  if (error) throw new Error(error.message);

  // Return the raw key strictly ONCE to the client memory, after which it ceases to exist in system scope
  return { keyRecord: data, rawKey: rawKeyString };
}
