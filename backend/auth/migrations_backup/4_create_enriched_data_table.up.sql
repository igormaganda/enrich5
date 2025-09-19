CREATE TABLE enriched_data (
  job_id VARCHAR(255) PRIMARY KEY REFERENCES job_history(job_id),
  csv_content TEXT NOT NULL
);
