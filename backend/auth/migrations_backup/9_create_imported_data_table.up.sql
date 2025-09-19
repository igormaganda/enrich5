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
