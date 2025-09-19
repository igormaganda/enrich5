-- Add missing is_default column to enrichment_sources table
ALTER TABLE enrichment_sources ADD COLUMN is_default BOOLEAN DEFAULT FALSE;