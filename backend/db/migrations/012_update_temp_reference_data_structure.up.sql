-- Update temp_reference_data table structure for CSV fixed format
DROP TABLE IF EXISTS temp_reference_data CASCADE;
DROP TABLE IF EXISTS enrichment_results CASCADE;

-- Table temporaire pour stocker les données de référence par fichier
CREATE TABLE temp_reference_data (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  temp_hexacle_hash VARCHAR(255) NOT NULL,
  hexacle_original VARCHAR(255), -- HEXACLE du fichier original
  numero VARCHAR(255),           -- NUMERO
  voie VARCHAR(255),             -- VOIE 
  ville VARCHAR(255),            -- VILLE
  cod_post VARCHAR(255),         -- COD_POST
  cod_insee VARCHAR(255),        -- COD_INSEE
  raw_data JSONB, -- Pour stocker toutes les données brutes du fichier
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