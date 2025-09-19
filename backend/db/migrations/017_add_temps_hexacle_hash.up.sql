-- Add support for timestamp-based hexacle hashes in enrichment workflow tables
ALTER TABLE temp_reference_data
ADD COLUMN temps_hexacle_hash VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX idx_temp_reference_data_temps_hexacle_hash ON temp_reference_data(temps_hexacle_hash);

ALTER TABLE enrichment_results
ADD COLUMN temps_hexacle_hash VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX idx_enrichment_results_temps_hexacle_hash ON enrichment_results(temps_hexacle_hash);
