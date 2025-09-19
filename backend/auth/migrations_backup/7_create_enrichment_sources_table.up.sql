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
