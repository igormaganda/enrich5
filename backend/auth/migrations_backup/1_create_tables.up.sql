-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user sessions table for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

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

CREATE TABLE job_history (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  file_type VARCHAR(50) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_enriched INTEGER DEFAULT 0,
  error_message TEXT,
  r2_url VARCHAR(500),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) NOT NULL
);

CREATE TABLE temp_ftth_import (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  hexacle VARCHAR(255),
  zone_ftth VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE temp_4gbox_import (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  hexacle VARCHAR(255),
  zone_4gbox VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE temp_mobile_import (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  hexacle VARCHAR(255),
  mobile_zone VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE temp_blacklist_import (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  hexacle VARCHAR(255),
  blacklisted BOOLEAN DEFAULT TRUE,
  reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_hexacle ON contacts(hexacle);
CREATE INDEX idx_job_history_status ON job_history(status);
CREATE INDEX idx_job_history_created_by ON job_history(created_by);
CREATE INDEX idx_temp_ftth_job_id ON temp_ftth_import(job_id);
CREATE INDEX idx_temp_4gbox_job_id ON temp_4gbox_import(job_id);
CREATE INDEX idx_temp_mobile_job_id ON temp_mobile_import(job_id);
CREATE INDEX idx_temp_blacklist_job_id ON temp_blacklist_import(job_id);
