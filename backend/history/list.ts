import { api } from "encore.dev/api";
import { historyDB } from "./db";
import type { GetHistoryRequest, GetHistoryResponse, JobHistoryEntry } from "./types";

// Retrieves job history with optional filtering
export const getHistory = api<GetHistoryRequest, GetHistoryResponse>(
  { expose: true, method: "GET", path: "/history" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;
    
    let jobs: JobHistoryEntry[];
    let totalResult: {count: number} | null;
    
    if (req.userId) {
      jobs = await historyDB.queryAll<JobHistoryEntry>`
        SELECT 
          id,
          job_id as "jobId",
          filename,
          status,
          file_type as "fileType",
          records_processed as "recordsProcessed",
          records_enriched as "recordsEnriched",
          error_message as "errorMessage",
          r2_url as "r2Url",
          started_at as "startedAt",
          completed_at as "completedAt",
          created_by as "createdBy"
        FROM job_history 
        WHERE created_by = ${req.userId}
        ORDER BY started_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      totalResult = await historyDB.queryRow<{count: number}>`
        SELECT COUNT(*) as count FROM job_history WHERE created_by = ${req.userId}
      `;
    } else {
      jobs = await historyDB.queryAll<JobHistoryEntry>`
        SELECT 
          id,
          job_id as "jobId",
          source_id as "sourceId",
          filename,
          status,
          file_type as "fileType",
          records_processed as "recordsProcessed",
          records_enriched as "recordsEnriched",
          error_message as "errorMessage",
          r2_url as "r2Url",
          started_at as "startedAt",
          completed_at as "completedAt",
          created_by as "createdBy"
        FROM job_history 
        ORDER BY started_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      totalResult = await historyDB.queryRow<{count: number}>`
        SELECT COUNT(*) as count FROM job_history
      `;
    }
    
    return {
      jobs,
      total: totalResult?.count || 0
    };
  }
);
