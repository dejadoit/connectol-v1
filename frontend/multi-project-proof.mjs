const SUPABASE_URL = "https://acewlqwzbjvjxssdmdlx.supabase.co"; 
const rawKey = "agnt_fe07ac2be185450b9790fb5e1433def8"; 

async function run() {
  console.log("== 1. ChatGPT dynamically runs GET /projects ==");
  const listRes = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects`, {
     headers: { Authorization: `Bearer ${rawKey}` }
  });
  const listJson = await listRes.json();
  console.log("Projects Found:", listJson.projects.map(p => p.name).join(", "), "\n");

  const projA = listJson.projects.find(p => p.name === "LOWEND V2 Platform");
  const projB = listJson.projects.find(p => p.name === "connectol");

  console.log(`== 2. ChatGPT targets Project A [${projA.name}] =="`);
  console.log(`-> GET /projects/${projA.id}/context?compact=true`);
  const ctxA = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${projA.id}/context?compact=true`, { headers: { Authorization: `Bearer ${rawKey}` }});
  console.log(`Context Retrieved for ${projA.name}. Proceeding to write code block...\n`);

  console.log(`== 3. ChatGPT writes Draft to Project A Inbox ==`);
  const postARes = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${projA.id}/workspace`, {
     method: 'POST',
     headers: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({
         entry_type: "suggestion",
         title: "ChatGPT Multi-Project Proof - Draft A",
         content: "Testing project boundary isolation. This is Draft A explicitly targeting LOWEND V2 Platform.",
         metadata: { source: "chatgpt_global", model: "gpt-4o" }
     })
  });
  console.log("Draft A Status:", await postARes.json(), "\n");

  console.log(`== 4. ChatGPT switches context to Project B [${projB.name}] ==`);
  console.log(`-> GET /projects/${projB.id}/context?compact=true`);
  const ctxB = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${projB.id}/context?compact=true`, { headers: { Authorization: `Bearer ${rawKey}` }});
  console.log(`Context Retrieved for ${projB.name}. Proceeding to write feature spec...\n`);

  console.log(`== 5. ChatGPT writes Draft to Project B Inbox ==`);
  const postBRes = await fetch(`${SUPABASE_URL}/functions/v1/connectol/projects/${projB.id}/workspace`, {
     method: 'POST',
     headers: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({
         entry_type: "suggestion",
         title: "ChatGPT Multi-Project Proof - Draft B",
         content: "Testing project boundary isolation. This is Draft B explicitly targeting connectol.",
         metadata: { source: "chatgpt_global", model: "gpt-4o" }
     })
  });
  console.log("Draft B Status:", await postBRes.json(), "\n");
}
run();
