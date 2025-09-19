-- Table pour stocker les informations des archives en cours de traitement
CREATE TABLE archive_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  archive_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'processing', -- processing, enriching, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  download_url VARCHAR(500)
);

-- Table temporaire pour stocker les données des 4 fichiers pendant le traitement
CREATE TABLE temp_archive_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_job_id UUID REFERENCES archive_jobs(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50), -- contact_data, blacklist, etc.
  row_data JSONB NOT NULL, -- Stockage des données de ligne en JSON
  hexacle_hash VARCHAR(500), -- Hash calculé pour la correspondance
  is_enriched BOOLEAN DEFAULT FALSE,
  enriched_data JSONB, -- Données enrichies après correspondance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances de recherche
CREATE INDEX idx_temp_archive_data_archive_job_id ON temp_archive_data(archive_job_id);
CREATE INDEX idx_temp_archive_data_hexacle_hash ON temp_archive_data(hexacle_hash);
CREATE INDEX idx_temp_archive_data_file_type ON temp_archive_data(file_type);
CREATE INDEX idx_archive_jobs_status ON archive_jobs(status);