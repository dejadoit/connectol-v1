import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://acewlqwzbjvjxssdmdlx.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Svy3R4aMA1T9DoF2_6mkqg_7hdeOgdc";

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'operator@connectol.test',
    password: 'securepassword123'
  });
  if (error) throw error;

  console.log("Logged in:", data.session.access_token.substring(0, 10));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/test/docs/test`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: "test" })
  });

  console.log(res.status);
  console.log(await res.text());
}
test().catch(console.error);
