const SUPABASE_URL = "https://acewlqwzbjvjxssdmdlx.supabase.co"; // Replace with static live URL since process.env might lack it
const rawKey = "agnt_fe07ac2be185450b9790fb5e1433def8";

async function run() {
  console.log("== 1. Running GET /projects ==");
  const listRes = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects`, {
     headers: { Authorization: `Bearer ${rawKey}` }
  });
  const listJson = await listRes.json();
  console.log(JSON.stringify(listJson, null, 2) + "\n");
  
  if (!listJson.projects || listJson.projects.length === 0) {
      console.log("No projects found!");
      return;
  }
  const projectId = listJson.projects[0].id;

  console.log(`== 2. Running GET /projects/${projectId}/context?compact=true ==`);
  const ctxRes = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${projectId}/context?compact=true`, {
     headers: { Authorization: `Bearer ${rawKey}` }
  });
  const ctxJson = await ctxRes.json();
  console.log(JSON.stringify(ctxJson, null, 2) + "\n");

  console.log(`== 3. Running POST /projects/${projectId}/workspace ==`);
  const postRes = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${projectId}/workspace`, {
     method: 'POST',
     headers: { 
         Authorization: `Bearer ${rawKey}`,
         'Content-Type': 'application/json'
     },
     body: JSON.stringify({
         entry_type: "draft",
         title: "Backbone Verification Overload Payload",
         content: "This is a machine-generated string explicitly proving the Backbone API correctly digests generic REST inputs mapping straight to the database struct.",
         metadata: {
             source: "generic_curl_test",
             model: "node-fetch-bot"
         }
     })
  });
  const postJson = await postRes.json();
  console.log(JSON.stringify(postJson, null, 2) + "\n");
}
run();
