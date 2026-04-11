# Connectol — V1 Build Spec (Final)

**Version:** 1.1 — Locked (final amendments)
**Date:** 11 April 2026
**Author:** Jack + Claude + ChatGPT
**Status:** Ready for build — hand to AntiGravity

---

## What Is Connectol?

A **multi-AI project memory hub**. A centralised system where multiple AI agents and human operators contribute to a shared project memory, with a protected canonical truth layer that separates verified facts from working drafts.

**The problem:** AI chat threads are terrible long-term project memory. Context gets lost between sessions, decisions get re-litigated, and every new chat starts half-blind. Connectol gives every agent a workspace to write into, a single source of truth to read from, and a promotion workflow that stops draft garbage from becoming "fact."

**Tagline:** *One truth, many agents.*

---

## Architecture

### Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend / UI | Custom frontend scaffolded with Google Stitch, built out in AntiGravity | No platform lock-in. Stitch generates the visual shell fast, AG wires it up. |
| Backend / DB | Supabase (Postgres + Auth + Edge Functions) | Auth, RLS, real-time, API — all built in. Decision locked. |
| API | Supabase Edge Functions (Deno) | REST endpoints agents hit directly |
| File storage | Supabase Storage | Attachments, exports. Migrate to R2 only if volume demands it. |
| Auth | Supabase Auth | JWT for humans, API keys for agents |
| Build / deploy | AntiGravity | Codifies the Stitch shell into a working app, connects Supabase, handles deployment |

### System Diagram

```
┌──────────────────────────────────────────────────┐
│              CONNECTOL UI                         │
│    (Stitch scaffold → AntiGravity build-out)      │
│         Projects / Docs / Workspaces              │
└──────────────────┬───────────────────────────────┘
                   │ reads/writes
                   ▼
┌──────────────────────────────────────────────────┐
│              SUPABASE BACKEND                     │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │  Postgres   │  │  Auth      │  │  Storage    │ │
│  │  (all data) │  │  (JWT/keys)│  │  (files)    │ │
│  └────────────┘  └────────────┘  └─────────────┘ │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │         Edge Functions (REST API)           │   │
│  │   GET /context, POST /workspace, etc.       │   │
│  └────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────┘
                   │ API calls (authenticated)
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │ Claude │ │ ChatGPT│ │OpenClaw│ │Perplx. │
    │  Chat  │ │  Chat  │ │  /JJ   │ │        │
    └────────┘ └────────┘ └────────┘ └────────┘
```

---

## Data Model

### 1. `organisations`

Multi-tenant container. Exists in schema for future-proofing. V1 has one org, one owner, no org management UI.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `name` | text | e.g. "LOWEND" |
| `slug` | text | URL-friendly, unique |
| `created_at` | timestamptz | |
| `owner_id` | uuid | FK → auth.users |

### 2. `projects`

Top-level container for a build or initiative.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `org_id` | uuid | FK → organisations |
| `name` | text | e.g. "LOWEND Platform", "Connectol", "KRATE." |
| `description` | text | One-liner |
| `status` | enum | `active`, `paused`, `archived`, `completed` |
| `priority` | enum | `critical`, `high`, `medium`, `low` |
| `repo_url` | text | nullable — link to GitHub/GitLab |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3. `canonical_documents`

The protected truth layer. Official project docs.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `project_id` | uuid | FK → projects |
| `doc_type` | enum | See doc types below |
| `title` | text | |
| `content` | text | Markdown body |
| `summary` | text | nullable — short summary for compact context endpoint |
| `version` | integer | Increments on every update |
| `last_updated_by_type` | enum | `user`, `agent` |
| `last_updated_by_id` | uuid | FK → auth.users or api_keys.id |
| `last_updated_by_label` | text | Display name, e.g. "Jack", "claude", "jj" |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Doc types (enum):**
- `current_state` — what the project is, where it's at right now
- `architecture` — components, data flow, constraints
- `decisions` — log of choices made and why
- `tasks` — now / next / later / blocked
- `blockers` — current impediments
- `handoff` — context for the next session
- `changelog` — what changed and when
- `known_issues` — bugs, dead ends, failed attempts
- `custom` — anything else

**Uniqueness constraint:** For each project, every core doc type (`current_state`, `architecture`, `decisions`, `tasks`, `blockers`, `handoff`, `changelog`, `known_issues`) is **one-per-project**. Only `custom` allows multiple docs per project. Enforce this with a partial unique index:

```sql
CREATE UNIQUE INDEX unique_core_doc_per_project
  ON canonical_documents (project_id, doc_type)
  WHERE doc_type != 'custom';
```

The API and UI must also enforce this: when creating a canonical doc, if a core doc type already exists for that project, reject the create and return an error. Promotion into a core type that already exists must use merge (append/replace), not create.

### 4. `workspace_entries`

Per-agent scratchpad. Drafts, notes, suggestions — not truth until promoted.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `project_id` | uuid | FK → projects |
| `agent_name` | text | e.g. "claude", "chatgpt", "openclaw", "jj", "jack" |
| `entry_type` | enum | `draft`, `note`, `suggestion`, `experiment`, `plan`, `analysis`, `handover` |
| `title` | text | Short descriptor |
| `content` | text | Markdown body |
| `status` | enum | `active`, `promoted`, `rejected`, `stale`, `archived` |
| `confidence` | enum | `high`, `medium`, `low`, `speculative` |
| `related_doc_id` | uuid | nullable — FK → canonical_documents |
| `promoted_at` | timestamptz | nullable |
| `promoted_to_id` | uuid | nullable — FK → canonical_documents |
| `created_by_type` | enum | `user`, `agent` |
| `created_by_id` | uuid | FK → auth.users or api_keys.id |
| `created_by_label` | text | Display name |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | nullable — **soft delete only** (see Soft Delete Rule below) |

### Soft Delete Rule (applies everywhere)

There is **one rule, one behaviour, no interpretation gap:**

1. `DELETE` endpoints do **not** hard-delete rows. They set `deleted_at = now()` AND `status = 'archived'`.
2. All default reads (`GET` endpoints, UI queries, `/context` responses) exclude rows where `deleted_at IS NOT NULL`.
3. No hard delete exists anywhere in V1. Not in the API, not in the UI, not in direct SQL.
4. Rows with `deleted_at` set can be restored by setting `deleted_at = NULL` and `status = 'active'` (admin action only, not exposed in V1 UI).

### 5. `document_versions`

Audit trail. Every canonical doc update snapshots the previous version.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `document_id` | uuid | FK → canonical_documents |
| `version` | integer | |
| `content` | text | Full content at that version |
| `changed_by_type` | enum | `user`, `agent` |
| `changed_by_id` | uuid | |
| `changed_by_label` | text | Display name |
| `change_summary` | text | What changed and why |
| `created_at` | timestamptz | |

### 6. `api_keys`

Agent authentication with flat, explicit permissions.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `org_id` | uuid | FK → organisations |
| `name` | text | e.g. "JJ Production", "Claude Chat Sessions" |
| `key_hash` | text | Hashed. Raw key shown once on creation. |
| `agent_name` | text | Which agent this key is for |
| `allowed_project_ids` | uuid[] | Array of project IDs this key can access. Empty = all. |
| `can_read_canonical` | boolean | default true |
| `can_write_workspace` | boolean | default true |
| `can_read_workspace` | boolean | default true |
| `can_promote` | boolean | **default false — agents cannot self-promote in V1** |
| `last_used_at` | timestamptz | |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz | nullable |

---

## Truth Hierarchy

```
Level 1 — VERIFIED TRUTH
  └── canonical_documents (current_state, architecture, decisions)
  └── Live code / config (external, linked via repo_url)

Level 2 — WORKING TRUTH
  └── canonical_documents that are actively changing (tasks, blockers, handoff)

Level 3 — DRAFTS
  └── workspace_entries (suggestions, plans, notes, experiments)

Level 4 — EPHEMERAL
  └── Chat threads (not stored — disposable thinking rooms)
```

**The rule:** If a workspace entry says one thing and a canonical doc says another, the canonical doc wins. Always.

---

## Promotion Workflow

### Flow

```
Agent writes workspace entry (status: "active")
        │
        ▼
Human reviews via UI
        │
        ├── PROMOTE → content merged into canonical doc
        │              entry.status → "promoted"
        │              entry.promoted_to_id → target doc id
        │              entry.promoted_at → now
        │              canonical doc version increments
        │              previous doc version snapshotted
        │
        ├── REJECT  → entry.status → "rejected"
        │              stays visible for reference
        │
        └── ARCHIVE → entry.status → "archived"
                       hidden from default views
```

### V1 Rules
- Only users with `can_promote = true` can promote (agents cannot in V1)
- Promotion into existing doc: **append** or **replace** (user chooses)
- Promotion as new doc: creates a new canonical_document
- Every promotion snapshots the previous doc version
- No bulk promotion in V1

---

## API Design

### Base URL
```
https://<supabase-project>.supabase.co/functions/v1/connectol
```

### Authentication
- `Authorization: Bearer <api_key>` — for agents
- `Authorization: Bearer <jwt>` — for humans via the Connectol UI

All requests scoped to the org associated with the authenticated key/user.

---

### Endpoints

#### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects` | List all projects (scoped to org) |
| `GET` | `/projects/:id` | Get project details |
| `POST` | `/projects` | Create a project |
| `PATCH` | `/projects/:id` | Update project metadata |

#### Canonical Documents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:id/docs` | List all canonical docs |
| `GET` | `/projects/:id/docs/:doc_id` | Get specific doc |
| `GET` | `/projects/:id/docs?type=current_state` | Filter by doc type |
| `PATCH` | `/projects/:id/docs/:doc_id` | Update doc (requires promote permission) |
| `GET` | `/projects/:id/docs/:doc_id/versions` | Version history |

#### Workspace Entries

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:id/workspace` | List entries (excludes soft-deleted) |
| `GET` | `/projects/:id/workspace?agent=claude` | Filter by agent |
| `GET` | `/projects/:id/workspace?status=active` | Filter by status |
| `POST` | `/projects/:id/workspace` | Create entry |
| `PATCH` | `/projects/:id/workspace/:entry_id` | Update entry |
| `DELETE` | `/projects/:id/workspace/:entry_id` | **Soft delete** (sets deleted_at) |

#### Promotion

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/:id/promote` | Promote workspace entry to canonical |

**Request body:**
```json
{
  "entry_id": "uuid",
  "target_doc_id": "uuid | null",
  "merge_mode": "append | replace",
  "change_summary": "What changed and why"
}

// target_doc_id = null → creates new canonical document
// target_doc_id = uuid → merges into existing doc
```

#### Context (the killer endpoint)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:id/context` | Full project context for new AI sessions |
| `GET` | `/projects/:id/context?compact=true` | Compact version (summaries only) |

**Default response:**
```json
{
  "project": {
    "name": "LOWEND Platform",
    "status": "active",
    "priority": "high",
    "description": "DJ recording studio and membership platform",
    "repo_url": "https://github.com/..."
  },
  "canonical": {
    "current_state": {
      "content": "full markdown...",
      "version": 4,
      "updated_at": "2026-04-11T..."
    },
    "architecture": { "..." },
    "decisions": { "..." },
    "tasks": { "..." },
    "blockers": { "..." },
    "handoff": { "..." },
    "known_issues": { "..." }
  },
  "recent_workspace": [
    {
      "agent": "claude",
      "title": "Suggested FFmpeg pipeline refactor",
      "content": "full markdown...",
      "confidence": "high",
      "entry_type": "suggestion",
      "status": "active",
      "created_at": "2026-04-10T..."
    }
  ]
}
```

**Compact response** (`?compact=true`):
- `canonical` returns `summary` field instead of full `content`
- If no summary exists, returns first 500 chars of content
- `recent_workspace` returns `title` and `confidence` only, no `content`

**Hard limits:**
- `recent_workspace` capped at **10 entries** (most recent, active only)
- Returns **latest version only** of each canonical doc
- Custom docs included if they exist

---

## Agent Integration Patterns

### Pattern 1: Chat-based AIs (Claude, ChatGPT, Perplexity)
Manual in V1:
1. User hits `GET /projects/:id/context` (or `?compact=true`)
2. Pastes response into start of chat
3. End of session: user or AI composes workspace entry
4. User posts via `POST /projects/:id/workspace` or pastes into UI

### Pattern 2: Autonomous agents (JJ, OpenClaw, AntiGravity)
Automated via API:
1. Agent reads: `GET /projects/:id/context`
2. Agent works
3. Agent writes: `POST /projects/:id/workspace`
4. Human reviews and promotes via UI

### Pattern 3: Human operator (Jack)
Via Connectol UI:
1. Open project
2. Read canonical docs
3. Review workspace entries
4. Promote / reject / archive
5. Edit canonical docs directly

---

## V1 UI

### Views

1. **Project View** — The main screen. Shows:
   - Project header (name, status, priority, repo link)
   - Canonical docs as tabs (one tab per doc type)
   - Workspace entries list (filterable by agent, status)
   - Markdown rendering for all content

2. **Doc Editor** — Edit canonical docs. Simple markdown textarea with preview. No fancy editor needed for V1.

3. **Promotion View** — Side-by-side: workspace entry on left, target canonical doc on right. Append/replace toggle. Change summary input. Promote button.

4. **API Keys Page** — Create/revoke API keys. Show raw key once on creation. List active keys with last_used_at.

### V1 UI Rules
- Fast to scan. "Where are we?" in under 10 seconds.
- Promotion must be dead simple. Review → approve in two clicks.
- All content shows attribution: who wrote it, when.
- Markdown rendered everywhere.
- No dashboard page in V1 — project list can be a simple sidebar or dropdown.
- No activity timeline in V1.
- No search in V1.

---

## V1 Scope — Locked

### In

- [ ] Supabase project: schema (6 tables), RLS policies
- [ ] `GET /projects/:id/context` (default + compact)
- [ ] `POST /projects/:id/workspace`
- [ ] `GET /projects/:id/workspace`
- [ ] Canonical docs CRUD
- [ ] `POST /projects/:id/promote`
- [ ] API key auth (create, revoke, validate)
- [ ] Stitch: scaffold UI shell (project view, doc tabs, workspace list, promotion screen, API keys page)
- [ ] AntiGravity: import Stitch shell, wire to Supabase, build all UI views as working app
- [ ] UI: project view with canonical docs + workspace entries
- [ ] UI: doc editor (markdown)
- [ ] UI: promotion view (side-by-side, append/replace)
- [ ] UI: API keys page
- [ ] Soft delete on workspace entries
- [ ] Version history on canonical docs
- [ ] Attribution (actor_type, actor_id, actor_label) on all writes
- [ ] Deploy to Vercel (or equivalent)

### Stitch Brief Constraints

The Stitch scaffold must be a **plain internal operator app**. Enforce these rules:

- No marketing-site styling
- No 3D animations, parallax, or cinematic scrolling
- No hero sections, testimonials, or conversion-oriented layouts
- Clean sidebar or top nav
- Readable typography, neutral palette
- Responsive but not mobile-first (this is a desktop operator tool)
- Every view must be functional layout, not decorative

### Out (V2+)

- Dashboard with cross-project overview
- Activity timeline
- Search
- Contradiction detection
- Stale truth warnings
- Diff view
- Tags / cross-references
- Bulk promotion
- Export as markdown bundle
- Auto-ingest from chat transcripts
- Webhooks
- GitHub connector
- Semantic / vector search
- Agent-to-agent sharing rules
- Public project links
- Multi-org UI
- Org invites / team management

---

## Security (V1)

### Auth Model — Two Paths, Explicitly Different

Supabase RLS does **not** understand custom API keys. The `api_keys` table is application-managed, not a Supabase Auth provider. This means there are two distinct auth paths, and they must not be conflated:

**Path 1: Human users (JWT via Supabase Auth)**
- User logs in via Supabase Auth (email/password or OAuth)
- Supabase issues a JWT
- All requests from the Connectol UI include this JWT in the `Authorization` header
- RLS policies on all tables enforce org scoping using `auth.uid()` → user's `org_id`
- This path is fully handled by Supabase Auth + RLS. No custom middleware needed.

**Path 2: Agent API keys (custom `api_keys` table)**
- Agent sends `Authorization: Bearer <api_key>` in request header
- **Edge Function middleware** (not RLS) handles this path:
  1. Middleware extracts the key from the header
  2. Hashes it and looks up `api_keys` table to find a matching, non-revoked key
  3. Checks `allowed_project_ids` against the requested project
  4. Checks permission flags (`can_read_canonical`, `can_write_workspace`, etc.)
  5. If all checks pass, the Edge Function executes the DB query using the **service role client** (which bypasses RLS)
  6. The Edge Function itself enforces org/project scoping in the query — RLS is not involved for agent requests
- **Critical:** Because agent requests use the service role client, the Edge Function code is the entire security boundary. Every query must explicitly filter by `org_id` and `project_id`. Do not rely on RLS for agent-path requests.

**Summary:**

| Concern | Human (JWT) | Agent (API key) |
|---------|-------------|-----------------|
| Auth validation | Supabase Auth | Edge Function middleware |
| Org/project scoping | RLS policies | Edge Function query filters |
| DB client used | Anon client (RLS enforced) | Service role client (RLS bypassed) |
| Permission checks | RLS + org membership | Middleware checks `api_keys` flags |

### RLS Policies (human path only)

RLS policies protect all tables for JWT-authenticated requests:
- `organisations`: user can only see orgs where they are `owner_id`
- `projects`: user can only see projects where `org_id` matches their org
- `canonical_documents`: scoped via project → org chain
- `workspace_entries`: scoped via project → org chain; `deleted_at IS NULL` filter in default views
- `document_versions`: scoped via document → project → org chain
- `api_keys`: user can only see keys for their org

### Permission Rules

| Action | Human (JWT) | Agent (API key) |
|--------|-------------|-----------------|
| Read canonical docs | ✅ | ✅ (if `can_read_canonical`) |
| Write canonical docs | ✅ | ❌ |
| Read workspace | ✅ | ✅ (if `can_read_workspace`) |
| Write workspace | ✅ | ✅ (if `can_write_workspace`, own agent only) |
| Promote entries | ✅ | ❌ (V1) |
| Create API keys | ✅ | ❌ |
| Manage projects | ✅ | ❌ |

---

## Naming Conventions

### Agent names (standardised, lowercase)
`claude`, `chatgpt`, `openclaw`, `antigravity`, `perplexity`, `jack`, `jj`

### Doc type slugs
Snake_case as defined in enum: `current_state`, `architecture`, `decisions`, `tasks`, `blockers`, `handoff`, `changelog`, `known_issues`, `custom`

### API key names
Descriptive: `"JJ Production"`, `"Claude Chat Sessions"`, `"OpenClaw Pipeline"`

---

## Build Order

This is the sequence. Don't skip ahead.

| # | Task | Why |
| # | Task | Who | Why |
|---|------|-----|-----|
| 1 | Supabase project + schema + RLS | AntiGravity | Foundation. Nothing works without this. |
| 2 | `GET /context` endpoint | AntiGravity | Most immediately useful. Paste context into any chat before UI exists. |
| 3 | `POST /workspace` endpoint | AntiGravity | Let agents start writing entries. |
| 4 | `GET /workspace` endpoint | AntiGravity | Read back what agents wrote. |
| 5 | Canonical docs CRUD endpoints | AntiGravity | Read/write the truth layer. |
| 6 | `POST /promote` endpoint | AntiGravity | The promotion workflow. |
| 7 | API key creation + auth middleware | AntiGravity | Secure agent access. |
| 8 | UI shell: scaffold in Stitch | Stitch | Generate visual layout — project view, doc tabs, workspace list, promotion screen, API keys page. Plain operator app. No flashy design. Export as ZIP. |
| 9 | Import Stitch shell into AntiGravity | AntiGravity | Import ZIP, codify into working app, wire to Supabase. |
| 10 | UI: project view (live data) | AntiGravity | Canonical docs + workspace entries, connected to Supabase. |
| 11 | UI: doc editor | AntiGravity | Edit canonical docs with markdown. |
| 12 | UI: promotion view | AntiGravity | Review and promote workspace entries. |
| 13 | UI: API keys page | AntiGravity | Create/manage agent keys. |
| 14 | Deploy | AntiGravity | Push to GitHub, deploy to Vercel. |

---

## Success Criteria

V1 is done when:

1. A project exists with canonical docs viewable in the UI
2. An agent can `GET /context` and receive full project state
3. An agent can `POST /workspace` and its entry appears in the UI
4. Jack can review a workspace entry and promote it into a canonical doc via the UI
5. Promotion snapshots the previous doc version
6. All writes show who did them and when
7. A new AI chat session can be fully bootstrapped from the context endpoint in under 30 seconds

---

## Open Questions (to resolve during build)

1. **Markdown editor component** — Stitch/AG frontend needs a markdown editor. Options: CodeMirror, Monaco, or simple textarea + preview split. Keep it simple for V1.
2. **Auto-stale rules** — How many days before workspace entries auto-mark as stale? Suggest 14 days as default. Configurable per project in V2.
3. **Context endpoint auth** — Should `/context` require a specific scope, or is any valid API key with `can_read_canonical` sufficient?
4. **Summary generation** — Should `summary` on canonical docs be manually written, or auto-generated (e.g. first 500 chars)? V1: manual with fallback to truncation.
