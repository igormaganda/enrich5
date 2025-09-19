import { api } from "encore.dev/api";
import { db } from "./db";
import type { ArchiveJob } from "./types";

export interface GetArchiveStatusRequest {
  archiveJobId: string;
}

export interface GetArchiveStatusResponse {
  job: ArchiveJob | null;
  progress?: {
    totalRows: number;
    enrichedRows: number;
    blacklistedRows: number;
  };
}

export const getArchiveStatus = api<GetArchiveStatusRequest, GetArchiveStatusResponse>(
  { expose: true, method: "GET", path: "/archive/status/:archiveJobId" },
  async ({ archiveJobId }) => {
    try {
      // Récupérer le job d'archive
      const job = await db.queryRow`
        SELECT id, user_id, archive_name, status, created_at, completed_at, error_message, download_url
        FROM archive_jobs 
        WHERE id = ${archiveJobId}
      `;

      if (!job) {
        return { job: null };
      }

      // Récupérer les statistiques de progression
      const stats = await db.queryRow`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(CASE WHEN is_enriched = TRUE THEN 1 END) as enriched_rows,
          COUNT(CASE WHEN enriched_data::text LIKE '%"is_blacklisted":true%' THEN 1 END) as blacklisted_rows
        FROM temp_archive_data 
        WHERE archive_job_id = ${archiveJobId} 
        AND file_type = 'contact_data'
      `;

      const progress = stats ? {
        totalRows: Number(stats.total_rows) || 0,
        enrichedRows: Number(stats.enriched_rows) || 0,
        blacklistedRows: Number(stats.blacklisted_rows) || 0
      } : undefined;

      return {
        job: {
          id: job.id,
          userId: job.user_id,
          archiveName: job.archive_name,
          status: job.status,
          createdAt: job.created_at,
          completedAt: job.completed_at,
          errorMessage: job.error_message,
          downloadUrl: job.download_url
        },
        progress
      };

    } catch (error: any) {
      console.error("Erreur lors de la récupération du statut:", error);
      return { job: null };
    }
  }
);

export interface ListArchiveJobsRequest {
  userId: number;
  limit?: number;
  offset?: number;
}

export interface ListArchiveJobsResponse {
  jobs: ArchiveJob[];
  total: number;
}

export const listArchiveJobs = api<ListArchiveJobsRequest, ListArchiveJobsResponse>(
  { expose: true, method: "GET", path: "/archive/jobs" },
  async ({ userId, limit = 20, offset = 0 }) => {
    try {
      // Récupérer le nombre total
      const countResult = await db.queryRow`
        SELECT COUNT(*) as total 
        FROM archive_jobs 
        WHERE user_id = ${userId}
      `;
      
      const total = Number(countResult?.total) || 0;

      // Récupérer les jobs
      const jobsQuery = db.query`
        SELECT id, user_id, archive_name, status, created_at, completed_at, error_message, download_url
        FROM archive_jobs 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const jobs = [];
      for await (const row of jobsQuery) {
        jobs.push(row);
      }

      const formattedJobs: ArchiveJob[] = jobs.map((job: any) => ({
        id: job.id,
        userId: job.user_id,
        archiveName: job.archive_name,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
        downloadUrl: job.download_url
      }));

      return {
        jobs: formattedJobs,
        total
      };

    } catch (error: any) {
      console.error("Erreur lors de la récupération des jobs:", error);
      return {
        jobs: [],
        total: 0
      };
    }
  }
);