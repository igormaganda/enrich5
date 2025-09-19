import { api } from "encore.dev/api";
import { enrichmentDB as db } from "./db";

export interface EnrichmentJob {
  id: string;
  status: string;
  file_name: string;
  total_records: number;
  processed_records: number;
  matched_records: number;
  enriched_records: number;
  filtered_records: number;
  final_records: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export const listEnrichmentJobs = api<{ limit?: number }, { jobs: EnrichmentJob[] }>(
  { expose: true, method: "GET", path: "/enrichment/jobs" },
  async ({ limit = 50 }) => {
    const result = await db.query<EnrichmentJob>`
      SELECT
        id,
        status,
        file_name,
        total_records,
        processed_records,
        matched_records,
        enriched_records,
        filtered_records,
        final_records,
        error_message,
        created_at,
        started_at,
        completed_at
      FROM enrichment_jobs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    const jobs = [];
    for await (const job of result) {
      jobs.push(job);
    }
    return { jobs };
  }
);
