-- Table pour historiser les fichiers déjà traités et éviter le re-traitement
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