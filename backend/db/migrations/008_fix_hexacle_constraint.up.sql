-- Remove the NOT NULL constraint from hexacle column as it's no longer used as primary identifier
-- We now use hexacle_hash as the main identifier
ALTER TABLE contacts ALTER COLUMN hexacle DROP NOT NULL;