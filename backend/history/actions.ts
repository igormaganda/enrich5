import { api, APIError } from "encore.dev/api";
import { historyDB } from "./db";
import type { CancelJobRequest, DeleteJobRequest, JobActionResponse } from "./action_types";

// Create a new job entry
export const createJob = api<{
  jobId: string;
  filename: string;
  fileType: string;
  userId: string;
}, JobActionResponse>(
  { expose: true, method: "POST", path: "/create" },
  async (req) => {
    try {
      await historyDB.exec`
        INSERT INTO job_history (job_id, filename, status, file_type, created_by)
        VALUES (${req.jobId}, ${req.filename}, 'processing', ${req.fileType}, ${req.userId})
      `;

      return {
        success: true,
        message: "Job created successfully"
      };
    } catch (error) {
      throw APIError.internal("Failed to create job", error as Error);
    }
  }
);

// Update job status
export const updateJobStatus = api<{
  jobId: string;
  status: string;
  recordsProcessed?: number;
  recordsEnriched?: number;
  r2Url?: string;
  errorMessage?: string;
}, JobActionResponse>(
  { expose: true, method: "POST", path: "/update-status" },
  async (req) => {
    try {
      if (req.status === 'completed' || req.status === 'failed') {
        await historyDB.exec`
          UPDATE job_history 
          SET status = ${req.status},
              records_processed = ${req.recordsProcessed || 0},
              records_enriched = ${req.recordsEnriched || 0},
              r2_url = ${req.r2Url || null},
              error_message = ${req.errorMessage || null},
              completed_at = NOW()
          WHERE job_id = ${req.jobId}
        `;
      } else {
        await historyDB.exec`
          UPDATE job_history 
          SET status = ${req.status},
              records_processed = ${req.recordsProcessed || 0}
          WHERE job_id = ${req.jobId}
        `;
      }

      return {
        success: true,
        message: "Job status updated successfully"
      };
    } catch (error) {
      throw APIError.internal("Failed to update job status", error as Error);
    }
  }
);

// Cancel a running job
export const cancelJob = api<CancelJobRequest, JobActionResponse>(
  { expose: true, method: "POST", path: "/cancel" },
  async (req) => {
    try {
      // Get current job status
      const job = await historyDB.queryRow<{ status: string }>`
        SELECT status FROM job_history WHERE job_id = ${req.jobId}
      `;

      if (!job) {
        throw APIError.notFound("Job not found");
      }

      if (job.status === 'completed') {
        throw APIError.failedPrecondition("Cannot cancel completed job");
      }

      if (job.status === 'failed') {
        throw APIError.failedPrecondition("Job already failed");
      }

      // Cancel the job
      await historyDB.exec`
        UPDATE job_history 
        SET status = 'cancelled', 
            error_message = 'Job cancelled by user',
            completed_at = NOW()
        WHERE job_id = ${req.jobId}
      `;

      return {
        success: true,
        message: "Job cancelled successfully"
      };
    } catch (error) {
      throw APIError.internal("Failed to cancel job", error as Error);
    }
  }
);

// Delete a job from history
export const deleteJob = api<DeleteJobRequest, JobActionResponse>(
  { expose: true, method: "DELETE", path: "/delete" },
  async (req) => {
    try {
      // Check if job exists
      const job = await historyDB.queryRow<{ status: string }>`
        SELECT status FROM job_history WHERE job_id = ${req.jobId}
      `;

      if (!job) {
        throw APIError.notFound("Job not found");
      }

      // Don't allow deletion of running jobs
      if (job.status === 'processing' || job.status === 'extracting' || 
          job.status === 'validating' || job.status === 'enriching') {
        throw APIError.failedPrecondition("Cannot delete running job. Cancel it first.");
      }

      // Delete the job
      await historyDB.exec`
        DELETE FROM job_history WHERE job_id = ${req.jobId}
      `;

      return {
        success: true,
        message: "Job deleted successfully"
      };
    } catch (error) {
      throw APIError.internal("Failed to delete job", error as Error);
    }
  }
);