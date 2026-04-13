// no import needed

const ACCESS_TOKEN = "sbp_e0fa77fb20e1b1eb1f1f57808aa977615fa244d2";
const PROJECT_REF = "acewlqwzbjvjxssdmdlx";

const MIGRATION = `
ALTER TABLE workspace_entries 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
`;

async function run() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: MIGRATION
    })
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
