CREATE TABLE ftp_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES ftp_servers(id) ON DELETE CASCADE,
  files_found INTEGER DEFAULT 0,
  files_downloaded INTEGER DEFAULT 0,
  errors JSONB,
  scan_started_at TIMESTAMP DEFAULT NOW(),
  scan_completed_at TIMESTAMP,
  job_id UUID REFERENCES background_jobs(id) ON DELETE SET NULL
);

CREATE INDEX idx_ftp_scan_logs_server_id ON ftp_scan_logs(server_id);
CREATE INDEX idx_ftp_scan_logs_scan_started_at ON ftp_scan_logs(scan_started_at);