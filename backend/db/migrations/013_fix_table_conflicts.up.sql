-- Clean migration to fix any table conflicts and ensure all tables exist

-- Clean up old blacklist filters table
DROP TABLE IF EXISTS blacklist_filters CASCADE;

-- Ensure mobile_blacklist table exists
CREATE TABLE IF NOT EXISTS mobile_blacklist (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  source_file VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_blacklist_phone ON mobile_blacklist(phone_number);
CREATE INDEX IF NOT EXISTS idx_mobile_blacklist_source_file ON mobile_blacklist(source_file);

-- Ensure blacklist_jobs table exists
CREATE TABLE IF NOT EXISTS blacklist_jobs (
  id VARCHAR(255) PRIMARY KEY,
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(500),
  total_numbers INTEGER DEFAULT 0,
  processed_numbers INTEGER DEFAULT 0,
  duplicate_numbers INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_blacklist_jobs_status ON blacklist_jobs(status);

-- Ensure updated temp_reference_data table exists
DROP TABLE IF EXISTS temp_reference_data CASCADE;
DROP TABLE IF EXISTS enrichment_results CASCADE;

CREATE TABLE temp_reference_data (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  temp_hexacle_hash VARCHAR(255) NOT NULL,
  hexacle_original VARCHAR(255),
  numero VARCHAR(255),
  voie VARCHAR(255),
  ville VARCHAR(255),
  cod_post VARCHAR(255),
  cod_insee VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_temp_reference_data_job_id ON temp_reference_data(job_id);
CREATE INDEX idx_temp_reference_data_temp_hexacle_hash ON temp_reference_data(temp_hexacle_hash);

-- Ensure enrichment_results table exists
CREATE TABLE enrichment_results (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  temp_hexacle_hash VARCHAR(255) NOT NULL,
  found_match BOOLEAN DEFAULT false,
  enriched_data JSONB,
  reference_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enrichment_results_job_id ON enrichment_results(job_id);
CREATE INDEX idx_enrichment_results_temp_hexacle_hash ON enrichment_results(temp_hexacle_hash);

-- Ensure enrichment_jobs table exists
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'pending',
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(500),
  server_id VARCHAR(255),
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  matched_records INTEGER DEFAULT 0,
  enriched_records INTEGER DEFAULT 0,
  filtered_records INTEGER DEFAULT 0,
  final_records INTEGER DEFAULT 0,
  result_file_path VARCHAR(500),
  result_download_url VARCHAR(500),
  error_message TEXT,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_created_at ON enrichment_jobs(created_at);