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