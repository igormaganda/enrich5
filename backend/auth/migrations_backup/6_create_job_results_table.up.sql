CREATE TABLE job_results (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL REFERENCES job_history(job_id),
  result_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_results_job_id ON job_results(job_id);
