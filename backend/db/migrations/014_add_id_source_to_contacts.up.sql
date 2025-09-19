-- Add source_id to contacts table
ALTER TABLE contacts
ADD COLUMN id_source VARCHAR(255);
