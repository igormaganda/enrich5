-- Create mobile_blacklist table for phone numbers only
DROP TABLE IF EXISTS blacklist_filters;

CREATE TABLE mobile_blacklist (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL UNIQUE, -- Numéro sans indicatif
  source_file VARCHAR(500), -- Nom du fichier source
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mobile_blacklist_phone ON mobile_blacklist(phone_number);
CREATE INDEX idx_mobile_blacklist_source_file ON mobile_blacklist(source_file);

-- Table pour stocker les jobs de traitement de blacklist
CREATE TABLE blacklist_jobs (
  id VARCHAR(255) PRIMARY KEY,
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(500),
  total_numbers INTEGER DEFAULT 0,
  processed_numbers INTEGER DEFAULT 0,
  duplicate_numbers INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_blacklist_jobs_status ON blacklist_jobs(status);