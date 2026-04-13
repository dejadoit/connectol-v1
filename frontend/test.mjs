const r = await fetch('https://acewlqwzbjvjxssdmdlx.supabase.co/functions/v1/connectol/create-test-key');
console.log(r.status);
console.log(await r.text());
