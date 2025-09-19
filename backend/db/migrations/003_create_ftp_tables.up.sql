-- Create FTP servers table
CREATE TABLE ftp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 21,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  path VARCHAR(500) DEFAULT '/',
  file_pattern VARCHAR(255) DEFAULT '*.csv',
  delete_after_download BOOLEAN DEFAULT false,
  poll_interval INTEGER DEFAULT 60, -- en minutes
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create background_jobs table
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0, -- 0-100
  current_step VARCHAR(255),
  total_steps INTEGER DEFAULT 1,
  completed_steps INTEGER DEFAULT 0,
  data JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_duration INTEGER -- en secondes
);

CREATE INDEX idx_background_jobs_status ON background_jobs(status);
CREATE INDEX idx_background_jobs_type ON background_jobs(type);
CREATE INDEX idx_background_jobs_created_at ON background_jobs(created_at);

-- Create ftp_scan_logs table
CREATE TABLE ftp_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES ftp_servers(id) ON DELETE CASCADE,
  files_found INTEGER DEFAULT 0,
  files_downloaded INTEGER DEFAULT 0,
  file_details JSONB DEFAULT '[]'::jsonb,
  errors JSONB,
  scan_started_at TIMESTAMP DEFAULT NOW(),
  scan_completed_at TIMESTAMP,
  job_id UUID REFERENCES background_jobs(id) ON DELETE SET NULL
);

CREATE INDEX idx_ftp_scan_logs_server_id ON ftp_scan_logs(server_id);
CREATE INDEX idx_ftp_scan_logs_scan_started_at ON ftp_scan_logs(scan_started_at);

-- Create processed_files table
CREATE TABLE processed_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES ftp_servers(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  file_hash VARCHAR(64), -- MD5 hash du contenu du fichier pour détecter les changements
  processed_at TIMESTAMP DEFAULT NOW(),
  processing_status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'skipped'
  processing_job_id UUID, -- Référence vers le job de traitement
  error_message TEXT,
  deleted_from_ftp BOOLEAN DEFAULT false, -- Indique si le fichier a été supprimé du serveur FTP
  UNIQUE(server_id, file_name, file_size) -- Éviter les doublons pour même fichier
);

CREATE INDEX idx_processed_files_server_id ON processed_files(server_id);
CREATE INDEX idx_processed_files_file_name ON processed_files(file_name);
CREATE INDEX idx_processed_files_processed_at ON processed_files(processed_at);
CREATE INDEX idx_processed_files_status ON processed_files(processing_status);