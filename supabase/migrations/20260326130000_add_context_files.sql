-- Add context_files column to sites table
-- Stores structured markdown context files as a JSON map: { "ABOUT.md": "...", "BRAND.md": "...", ... }
-- These files are injected directly into the blog generation prompt
ALTER TABLE sites ADD COLUMN IF NOT EXISTS context_files jsonb DEFAULT '{}';
