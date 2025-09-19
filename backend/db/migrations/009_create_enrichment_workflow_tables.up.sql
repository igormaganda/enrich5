-- Tables pour le workflow d'enrichissement complet

-- Table temporaire pour stocker les données de référence par fichier
CREATE TABLE temp_reference_data (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  temp_hexacle_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  mobile_phone VARCHAR(255),
  landline_phone VARCHAR(255),
  address VARCHAR(500),
  city VARCHAR(255),
  postal_code VARCHAR(255),
  department VARCHAR(255),
  age INTEGER,
  raw_data JSONB, -- Pour stocker toutes les données brutes du fichier de référence
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_temp_reference_data_job_id ON temp_reference_data(job_id);
CREATE INDEX idx_temp_reference_data_temp_hexacle_hash ON temp_reference_data(temp_hexacle_hash);

-- Table pour stocker les résultats d'enrichissement
CREATE TABLE enrichment_results (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  temp_hexacle_hash VARCHAR(255) NOT NULL,
  found_match BOOLEAN DEFAULT false,
  enriched_data JSONB, -- Données enrichies depuis la table contacts
  reference_data JSONB, -- Données de référence du fichier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enrichment_results_job_id ON enrichment_results(job_id);
CREATE INDEX idx_enrichment_results_temp_hexacle_hash ON enrichment_results(temp_hexacle_hash);

-- Table pour blacklist/filtrage
CREATE TABLE blacklist_filters (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  filter_type VARCHAR(50) NOT NULL, -- 'email_domain', 'phone_prefix', 'email_exact', 'city', etc.
  filter_value VARCHAR(500) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blacklist_filters_type ON blacklist_filters(filter_type);
CREATE INDEX idx_blacklist_filters_active ON blacklist_filters(is_active);

-- Table pour les jobs d'enrichissement avec détails complets
CREATE TABLE enrichment_jobs (
  id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(500),
  server_id VARCHAR(255), -- UUID du serveur FTP
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

CREATE INDEX idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX idx_enrichment_jobs_created_at ON enrichment_jobs(created_at);