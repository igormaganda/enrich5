import { api } from "encore.dev/api";
import { enrichmentDB as db } from "./db";

export interface BlacklistFilter {
  id: number;
  name: string;
  filter_type: string;
  filter_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBlacklistFilterRequest {
  name: string;
  filter_type: string;
  filter_value: string;
  is_active?: boolean;
}

export interface UpdateBlacklistFilterRequest {
  id: number;
  name?: string;
  filter_type?: string;
  filter_value?: string;
  is_active?: boolean;
}

export const listBlacklistFilters = api<void, { filters: BlacklistFilter[] }>(
  { expose: true, method: "GET", path: "/enrichment/blacklist-filters" },
  async () => {
    const filtersResult = await db.query<BlacklistFilter>`
      SELECT id, name, filter_type, filter_value, is_active, created_at, updated_at
      FROM blacklist_filters
      ORDER BY created_at DESC
    `;
    
    const filters: BlacklistFilter[] = [];
    for await (const filter of filtersResult) {
      filters.push(filter);
    }
    
    return { filters };
  }
);

export const createBlacklistFilter = api<CreateBlacklistFilterRequest, { success: boolean; id: number }>(
  { expose: true, method: "POST", path: "/enrichment/blacklist-filters" },
  async ({ name, filter_type, filter_value, is_active = true }) => {
    const result = await db.queryRow<{ id: number }>`
      INSERT INTO blacklist_filters (name, filter_type, filter_value, is_active)
      VALUES (${name}, ${filter_type}, ${filter_value}, ${is_active})
      RETURNING id
    `;
    
    return { success: true, id: result?.id || 0 };
  }
);

export const updateBlacklistFilter = api<UpdateBlacklistFilterRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/enrichment/blacklist-filters/:id" },
  async ({ id, name, filter_type, filter_value, is_active }) => {
    let hasUpdates = false;
    
    if (name !== undefined) {
      await db.exec`UPDATE blacklist_filters SET name = ${name}, updated_at = NOW() WHERE id = ${id}`;
      hasUpdates = true;
    }
    if (filter_type !== undefined) {
      await db.exec`UPDATE blacklist_filters SET filter_type = ${filter_type}, updated_at = NOW() WHERE id = ${id}`;
      hasUpdates = true;
    }
    if (filter_value !== undefined) {
      await db.exec`UPDATE blacklist_filters SET filter_value = ${filter_value}, updated_at = NOW() WHERE id = ${id}`;
      hasUpdates = true;
    }
    if (is_active !== undefined) {
      await db.exec`UPDATE blacklist_filters SET is_active = ${is_active}, updated_at = NOW() WHERE id = ${id}`;
      hasUpdates = true;
    }
    
    return { success: true };
  }
);

export const deleteBlacklistFilter = api<{ id: number }, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/enrichment/blacklist-filters/:id" },
  async ({ id }) => {
    await db.exec`DELETE FROM blacklist_filters WHERE id = ${id}`;
    return { success: true };
  }
);

export interface EnrichmentJob {
  id: string;
  status: string;
  file_name: string;
  file_path?: string;
  server_id?: string;
  total_records: number;
  processed_records: number;
  matched_records: number;
  enriched_records: number;
  filtered_records: number;
  final_records: number;
  result_file_path?: string;
  result_download_url?: string;
  error_message?: string;
  email_sent: boolean;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface JobStatusResponse {
  job?: EnrichmentJob;
  error?: string;
}

export const getEnrichmentJobStatus = api<{ jobId: string }, JobStatusResponse>(
  { expose: true, method: "GET", path: "/enrichment/jobs/:jobId/status" },
  async ({ jobId }) => {
    const job = await db.queryRow<EnrichmentJob>`
      SELECT * FROM enrichment_jobs WHERE id = ${jobId}
    `;
    
    if (job) {
      return { job };
    } else {
      return { error: "Job not found" };
    }
  }
);

export const listEnrichmentJobs = api<void, { jobs: EnrichmentJob[] }>(
  { expose: true, method: "GET", path: "/enrichment/jobs" },
  async () => {
    const jobsResult = await db.query<EnrichmentJob>`
      SELECT * FROM enrichment_jobs 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    
    const jobs: EnrichmentJob[] = [];
    for await (const job of jobsResult) {
      jobs.push(job);
    }
    
    return { jobs };
  }
);