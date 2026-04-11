-- Supabase Initialization - Connectol V1 Schema

-- Enums
CREATE TYPE project_status AS ENUM ('active', 'paused', 'archived', 'completed');
CREATE TYPE project_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE doc_type AS ENUM ('current_state', 'architecture', 'decisions', 'tasks', 'blockers', 'handoff', 'changelog', 'known_issues', 'custom');
CREATE TYPE actor_type AS ENUM ('user', 'agent');
CREATE TYPE workspace_entry_type AS ENUM ('draft', 'note', 'suggestion', 'experiment', 'plan', 'analysis', 'handover');
CREATE TYPE workspace_status AS ENUM ('active', 'promoted', 'rejected', 'stale', 'archived');
CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low', 'speculative');

-- 1. organisations
CREATE TABLE organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active' NOT NULL,
    priority project_priority DEFAULT 'medium' NOT NULL,
    repo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. canonical_documents
CREATE TABLE canonical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    doc_type doc_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    version INTEGER DEFAULT 1 NOT NULL,
    last_updated_by_type actor_type NOT NULL,
    last_updated_by_id UUID NOT NULL, -- Polymorphic: auth.users or api_keys
    last_updated_by_label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX unique_core_doc_per_project
    ON canonical_documents (project_id, doc_type)
    WHERE doc_type != 'custom';

-- 4. workspace_entries
CREATE TABLE workspace_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    entry_type workspace_entry_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status workspace_status DEFAULT 'active' NOT NULL,
    confidence confidence_level DEFAULT 'medium' NOT NULL,
    related_doc_id UUID REFERENCES canonical_documents(id) ON DELETE SET NULL,
    promoted_at TIMESTAMPTZ,
    promoted_to_id UUID REFERENCES canonical_documents(id) ON DELETE SET NULL,
    created_by_type actor_type NOT NULL,
    created_by_id UUID NOT NULL, -- Polymorphic
    created_by_label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 5. document_versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES canonical_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changed_by_type actor_type NOT NULL,
    changed_by_id UUID NOT NULL,
    changed_by_label TEXT NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. api_keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    allowed_project_ids UUID[], -- Empty array means all projects
    can_read_canonical BOOLEAN DEFAULT true NOT NULL,
    can_write_workspace BOOLEAN DEFAULT true NOT NULL,
    can_read_workspace BOOLEAN DEFAULT true NOT NULL,
    can_promote BOOLEAN DEFAULT false NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    revoked_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies (for Human JWT authenticated via auth.uid())

-- Organisations: User can only see/modify orgs where they are owner
CREATE POLICY "Users view own orgs" ON organisations FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users modify own orgs" ON organisations FOR ALL USING (auth.uid() = owner_id);

-- Projects: User can only see/modify projects via org
CREATE POLICY "Users view org projects" ON projects FOR SELECT USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));
CREATE POLICY "Users modify org projects" ON projects FOR ALL USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));

-- Canonical Docs
CREATE POLICY "Users view project docs" ON canonical_documents FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())));
CREATE POLICY "Users modify project docs" ON canonical_documents FOR ALL USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())));

-- Workspace Entries (exclude deleted_at by default in view, though standard 'soft delete' usually implies filtering in the query. For safety, we enforce it in SELECT policy)
CREATE POLICY "Users view project workspace entries" ON workspace_entries FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())) AND deleted_at IS NULL);
CREATE POLICY "Users view deleted entries (admin)" ON workspace_entries FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())));
CREATE POLICY "Users modify project workspace entries" ON workspace_entries FOR ALL USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid())));

-- Document Versions
CREATE POLICY "Users view doc versions" ON document_versions FOR SELECT USING (document_id IN (SELECT id FROM canonical_documents WHERE project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()))));
CREATE POLICY "Users insert doc versions" ON document_versions FOR INSERT WITH CHECK (document_id IN (SELECT id FROM canonical_documents WHERE project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()))));

-- API Keys
CREATE POLICY "Users view own org keys" ON api_keys FOR SELECT USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));
CREATE POLICY "Users modify own org keys" ON api_keys FOR ALL USING (org_id IN (SELECT id FROM organisations WHERE owner_id = auth.uid()));
