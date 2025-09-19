-- Update contacts table structure for identity, address, basic info, and family data
-- All date fields should be in YYYY/MM/DD format

-- Add missing identity fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS numero_rue VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type_voie VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profession VARCHAR(255);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS situation_familiale VARCHAR(100);

-- Add missing family fields  
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS enfant4_date_naissance DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS enfant5_date_naissance DATE;

-- Ensure hexacle_hash exists (concatenation of numero_rue + adresse + ville + code_postal)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hexacle_hash VARCHAR(255);

-- Update date format constraints (ensure YYYY/MM/DD format)
-- These will be handled in the application layer to clean dates before insertion