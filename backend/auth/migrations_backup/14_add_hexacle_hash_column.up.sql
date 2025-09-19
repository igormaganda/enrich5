-- Add Hexacle_hash column to contacts table
ALTER TABLE contacts 
ADD COLUMN hexacle_hash VARCHAR(500);

-- Create index for better performance on hash searches
CREATE INDEX IF NOT EXISTS idx_contacts_hexacle_hash ON contacts(hexacle_hash);