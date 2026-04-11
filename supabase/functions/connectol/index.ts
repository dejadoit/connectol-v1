import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Parses and returns either an Agent API key Context or an underlying Supabase JWT client.
 */
async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing or invalid Authorization header");
  
  const rawKey = authHeader.substring(7);
  
  if (rawKey.split(".").length === 3) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) throw new Error("Unauthorized Human JWT");

    return { type: "human", client: userClient, user };
  } else {
    // Agent API Key path
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Hash the raw token locally to compare securely against the database record
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { data: keyData, error } = await serviceClient
      .from("api_keys")
      .select("*")
      .eq("key_hash", hashedHex)
      .single();

    if (error || !keyData) throw new Error("Unauthorized API key");
    if (keyData.revoked_at) throw new Error("API key revoked");

    return { type: "agent", client: serviceClient, key: keyData };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/connectol', '');
    
    let authContext;
    try {
      authContext = await authenticateRequest(req);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { type, client: supabase, user, key } = authContext;

    async function verifyAgentProjectAccess(projectId: string) {
      if (type === "agent") {
        if (key.allowed_project_ids && key.allowed_project_ids.length > 0 && !key.allowed_project_ids.includes(projectId)) {
          throw new Error("API key not authorized for this project");
        }
        const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).eq("org_id", key.org_id).single();
        if (error || !data) throw new Error("Project not found in organization");
      }
    }

    const contextPattern = new URLPattern({ pathname: "/projects/:id/context" });
    const contextMatch = contextPattern.exec({ pathname: path });

    if (contextMatch && req.method === "GET") {
      const projectId = contextMatch.pathname.groups.id!;
      await verifyAgentProjectAccess(projectId);

      if (type === "agent" && !key.can_read_canonical) {
        return new Response(JSON.stringify({ error: "Missing can_read_canonical permission" }), { status: 403, headers: corsHeaders });
      }

      let projectQuery = supabase.from("projects").select("*").eq("id", projectId);
      if (type === "agent") projectQuery = projectQuery.eq("org_id", key.org_id);
      
      const { data: project, error: projErr } = await projectQuery.single();
      if (projErr || !project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: corsHeaders });

      const isCompact = url.searchParams.get("compact") === "true";

      const docsQuery = supabase.from("canonical_documents").select("*").eq("project_id", projectId);
      const { data: docs } = await docsQuery;
      
      const canonicalFiles: Record<string, any> = {};
      (docs || []).forEach(doc => {
        if (!canonicalFiles[doc.doc_type]) {
           canonicalFiles[doc.doc_type] = {
             version: doc.version,
             updated_at: doc.updated_at,
             content: isCompact ? undefined : doc.content,
             summary: isCompact ? (doc.summary || doc.content.substring(0, 500)) : undefined
           }
        }
      });

      const workspaceQuery = supabase.from("workspace_entries").select("*").eq("project_id", projectId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
        
      const { data: workspaceRows } = await workspaceQuery;

      const recentWorkspace = (workspaceRows || []).map(row => ({
         agent: row.agent_name,
         title: row.title,
         entry_type: row.entry_type,
         confidence: row.confidence,
         status: row.status,
         created_at: row.created_at,
         content: isCompact ? undefined : row.content
      }));

      return new Response(JSON.stringify({ project: { name: project.name, status: project.status, priority: project.priority, description: project.description, repo_url: project.repo_url }, canonical: canonicalFiles, recent_workspace: recentWorkspace }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const docsPattern = new URLPattern({ pathname: "/projects/:id/docs" });
    const docsMatch = docsPattern.exec({ pathname: path });

    if (docsMatch && req.method === "GET") {
      const projectId = docsMatch.pathname.groups.id!;
      await verifyAgentProjectAccess(projectId);

      if (type === "agent" && !key.can_read_canonical) throw new Error("Missing can_read_canonical permission");

      let q = supabase.from("canonical_documents").select("*").eq("project_id", projectId);
      const docType = url.searchParams.get("type");
      if (docType) q = q.eq("doc_type", docType);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const docEntryPattern = new URLPattern({ pathname: "/projects/:id/docs/:docId" });
    const docEntryMatch = docEntryPattern.exec({ pathname: path });

    if (docEntryMatch) {
      const projectId = docEntryMatch.pathname.groups.id!;
      const docId = docEntryMatch.pathname.groups.docId!;
      await verifyAgentProjectAccess(projectId);

      if (req.method === "GET") {
         if (type === "agent" && !key.can_read_canonical) throw new Error("Missing can_read_canonical permission");
         const { data, error } = await supabase.from("canonical_documents").select("*").eq("id", docId).eq("project_id", projectId).single();
         if (error) throw new Error(error.message);
         return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PATCH") {
         if (type === "agent") throw new Error("Agent promotion globally restricted in V1");
         const body = await req.json();
         
         const { data: oldDoc, error: dErr } = await supabase.from("canonical_documents").select("*").eq("id", docId).eq("project_id", projectId).single();
         if (dErr || !oldDoc) throw new Error("Doc missing");

         const nextVersion = oldDoc.version + 1;
         
         await supabase.from("document_versions").insert({
              document_id: docId,
              version: oldDoc.version,
              content: oldDoc.content,
              changed_by_type: type,
              changed_by_id: user!.id,
              changed_by_label: user?.email?.split('@')[0] || "Unknown User",
              change_summary: body.change_summary || "Direct manual UI edit"
         });

         const { data, error } = await supabase.from("canonical_documents").update({
             content: body.content !== undefined ? body.content : oldDoc.content,
             title: body.title !== undefined ? body.title : oldDoc.title,
             summary: body.summary !== undefined ? body.summary : oldDoc.summary,
             version: nextVersion,
             last_updated_by_type: type,
             last_updated_by_id: user!.id,
             last_updated_by_label: user?.email?.split('@')[0] || "Unknown User",
             updated_at: new Date().toISOString()
         }).eq("id", docId).select().single();

         if (error) throw new Error(error.message);
         return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const docVersionsPattern = new URLPattern({ pathname: "/projects/:id/docs/:docId/versions" });
    const docVersionsMatch = docVersionsPattern.exec({ pathname: path });

    if (docVersionsMatch && req.method === "GET") {
       const projectId = docVersionsMatch.pathname.groups.id!;
       const docId = docVersionsMatch.pathname.groups.docId!;
       await verifyAgentProjectAccess(projectId);
       
       if (type === "agent" && !key.can_read_canonical) throw new Error("Missing can_read_canonical permission");
       
       const { data: docVerify } = await supabase.from("canonical_documents").select("id").eq("id", docId).eq("project_id", projectId).single();
       if (!docVerify) throw new Error("Invalid document context");

       const { data, error } = await supabase.from("document_versions").select("*").eq("document_id", docId).order("version", { ascending: false });
       if (error) throw new Error(error.message);
       return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const workspacePattern = new URLPattern({ pathname: "/projects/:id/workspace" });
    const workspaceMatch = workspacePattern.exec({ pathname: path });

    if (workspaceMatch) {
      const projectId = workspaceMatch.pathname.groups.id!;
      await verifyAgentProjectAccess(projectId);

      if (req.method === "GET") {
        if (type === "agent" && !key.can_read_workspace) throw new Error("Missing can_read_workspace permission");

        let q = supabase.from("workspace_entries").select("*").eq("project_id", projectId).is("deleted_at", null);
        const filterAgent = url.searchParams.get("agent");
        const filterStatus = url.searchParams.get("status");
        if (filterAgent) q = q.eq("agent_name", filterAgent);
        if (filterStatus) q = q.eq("status", filterStatus);

        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST") {
        if (type === "agent" && !key.can_write_workspace) throw new Error("Missing can_write_workspace permission");

        const body = await req.json();
        
        let createdByLabel = "";
        let agentName = "";
        
        if (type === "agent") {
            agentName = key.agent_name;
            createdByLabel = key.name;
        } else {
            agentName = body.agent_name || "human";
            createdByLabel = user?.email?.split('@')[0] || "Unknown User"; 
        }

        const payload = {
          project_id: projectId,
          agent_name: agentName,
          entry_type: body.entry_type || "note",
          title: body.title,
          content: body.content,
          confidence: body.confidence || "medium",
          related_doc_id: body.related_doc_id,
          created_by_type: type,
          created_by_id: type === "agent" ? key.id : user!.id,
          created_by_label: createdByLabel
        };

        const { data, error } = await supabase.from("workspace_entries").insert(payload).select().single();
        if (error) throw new Error(error.message);
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const workspaceEntryPattern = new URLPattern({ pathname: "/projects/:id/workspace/:entryId" });
    const workspaceEntryMatch = workspaceEntryPattern.exec({ pathname: path });

    if (workspaceEntryMatch && req.method === "DELETE") {
       const projectId = workspaceEntryMatch.pathname.groups.id!;
       const entryId = workspaceEntryMatch.pathname.groups.entryId!;
       await verifyAgentProjectAccess(projectId);
       
       if (type === "agent" && !key.can_write_workspace) throw new Error("Missing write permission");

       const { data, error } = await supabase.from("workspace_entries")
           .update({ deleted_at: new Date().toISOString(), status: 'archived' })
           .eq("id", entryId).eq("project_id", projectId).select().single();

       if (error) throw new Error(error.message);
       return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const promotePattern = new URLPattern({ pathname: "/projects/:id/promote" });
    const promoteMatch = promotePattern.exec({ pathname: path });

    if (promoteMatch && req.method === "POST") {
      const projectId = promoteMatch.pathname.groups.id!;
      await verifyAgentProjectAccess(projectId);

      // GLOBALLY BLOCKED AGENT PROMOTION IN V1
      if (type === "agent") throw new Error("Agent promotion globally restricted in V1");

      const body = await req.json();
      const entryId = body.entry_id;
      const mergeMode = body.merge_mode || "replace";
      const changeSummary = body.change_summary;
      
      const { data: wEntry, error: wErr } = await supabase.from("workspace_entries").select("*").eq("id", entryId).eq("project_id", projectId).single();
      if (wErr || !wEntry) throw new Error("Workspace entry missing");

      let targetCanonicalId = body.target_doc_id;
      
      let nextVersion = 1;
      
      if (targetCanonicalId) {
          const { data: oldDoc, error: dErr } = await supabase.from("canonical_documents").select("*").eq("id", targetCanonicalId).single();
          if (dErr || !oldDoc) throw new Error("Target canonical doc missing");
          
          nextVersion = oldDoc.version + 1;
          
          const { error: vErr } = await supabase.from("document_versions").insert({
              document_id: targetCanonicalId,
              version: oldDoc.version,
              content: oldDoc.content,
              changed_by_type: wEntry.created_by_type,
              changed_by_id: wEntry.created_by_id,
              changed_by_label: wEntry.created_by_label,
              change_summary: changeSummary || "Promoted update without summary"
          });
          if (vErr) throw new Error(`Snapshot failed: ${vErr.message}`);

          const finalContent = mergeMode === "append" ? oldDoc.content + "\n\n" + wEntry.content : wEntry.content;
          const { error: updateErr } = await supabase.from("canonical_documents").update({
              content: finalContent,
              version: nextVersion,
              last_updated_by_type: type,
              last_updated_by_id: type === "agent" ? key.id : user!.id,
              last_updated_by_label: type === "agent" ? key.name : (user?.email?.split('@')[0] || "Unknown User"),
              updated_at: new Date().toISOString()
          }).eq("id", targetCanonicalId);
          if (updateErr) throw new Error(`Canonical update failed: ${updateErr.message}`);
      } else {
         const { data: newDoc, error: createErr } = await supabase.from("canonical_documents").insert({
             project_id: projectId,
             doc_type: body.doc_type || "custom",
             title: wEntry.title,
             content: wEntry.content,
             version: 1,
             last_updated_by_type: type,
             last_updated_by_id: type === "agent" ? key.id : user!.id,
             last_updated_by_label: type === "agent" ? key.name : (user?.email?.split('@')[0] || "Unknown User")
         }).select("id").single();
         if (createErr) throw new Error(`Creation failed: ${createErr.message}`);
         targetCanonicalId = newDoc.id;
      }
      
      const { error: wUpdateErr } = await supabase.from("workspace_entries").update({
          status: "promoted",
          promoted_at: new Date().toISOString(),
          promoted_to_id: targetCanonicalId
      }).eq("id", entryId);
      
      if (wUpdateErr) throw new Error("Workspace status update failed");

      return new Response(JSON.stringify({ success: true, new_doc_id: targetCanonicalId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
