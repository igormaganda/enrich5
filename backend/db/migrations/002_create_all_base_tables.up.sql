-- Create contacts table
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  hexacle VARCHAR(255) UNIQUE NOT NULL,
  prenom VARCHAR(255),
  nom VARCHAR(255),
  email VARCHAR(255),
  telephone VARCHAR(20),
  age INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_hexacle ON contacts(hexacle);

-- Create job_history table
CREATE TABLE job_history (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  source_id VARCHAR(255),
  filename VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_enriched INTEGER DEFAULT 0,
  error_message TEXT,
  r2_url VARCHAR(500),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_job_history_job_id ON job_history(job_id);
CREATE INDEX idx_job_history_status ON job_history(status);
CREATE INDEX idx_job_history_created_by ON job_history(created_by);

-- Create job_results table
CREATE TABLE job_results (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL REFERENCES job_history(job_id),
  result_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_results_job_id ON job_results(job_id);

-- Create enrichment_sources table
CREATE TABLE enrichment_sources (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  has_headers BOOLEAN NOT NULL DEFAULT TRUE,
  delimiter VARCHAR(10) NOT NULL DEFAULT ';',
  mapping JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enrichment_sources_name ON enrichment_sources(name);

-- Create imported_data table
CREATE TABLE imported_data (
  id BIGSERIAL PRIMARY KEY,
  source_id VARCHAR(255) NOT NULL,
  hexacle VARCHAR(255),
  numero VARCHAR(255),
  voie VARCHAR(255),
  ville VARCHAR(255),
  cod_post VARCHAR(255),
  cod_insee VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_imported_data_source_id ON imported_data(source_id);
CREATE INDEX idx_imported_data_hexacle ON imported_data(hexacle);

-- Create app_settings table
CREATE TABLE app_settings (
  id BIGSERIAL PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section, key)
);

CREATE INDEX idx_app_settings_section ON app_settings(section);

-- Create source_configurations table
CREATE TABLE source_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT NOT NULL UNIQUE,
    mapping JSONB NOT NULL,
    delimiter TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_source_configurations_fingerprint ON source_configurations (fingerprint);