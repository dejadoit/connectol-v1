-- Migration to add structured JSON trace metadata to Workspace Entries for Connector integrations

ALTER TABLE workspace_entries 
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
