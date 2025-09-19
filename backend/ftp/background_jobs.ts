import { api, APIError } from "encore.dev/api";
import { db } from "./db";
import type {
  CreateBackgroundJobRequest,
  UpdateBackgroundJobRequest,
  ListBackgroundJobsResponse,
  GetBackgroundJobResponse,
  BackgroundJob
} from "./types";
import { v4 as uuidv4 } from "uuid";

export const createBackgroundJob = api<CreateBackgroundJobRequest, { id: string }>(
  { expose: true, method: "POST", path: "/ftp/background-jobs" },
  async (req) => {
    try {
      const id = uuidv4();
      
      await db.exec`
        INSERT INTO background_jobs (
          id, type, data, estimated_duration
        )
        VALUES (
          ${id}, ${req.type}, ${JSON.stringify(req.data)}, ${req.estimatedDuration || null}
        )
      `;
      
      return { id };
    } catch (error: any) {
      throw APIError.internal("Failed to create background job", error as Error);
    }
  }
);

export const listBackgroundJobs = api<{ limit?: number; status?: string }, ListBackgroundJobsResponse>(
  { expose: true, method: "GET", path: "/ftp/background-jobs" },
  async ({ limit = 50, status }) => {
    try {
      
      const jobsResult = status 
        ? await db.query<BackgroundJob>`
            SELECT 
              id,
              type,
              status,
              progress,
              current_step as "currentStep",
              total_steps as "totalSteps",
              completed_steps as "completedSteps",
              data,
              error,
              created_at as "createdAt",
              started_at as "startedAt",
              completed_at as "completedAt",
              estimated_duration as "estimatedDuration"
            FROM background_jobs
            WHERE status = ${status}
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `
        : await db.query<BackgroundJob>`
            SELECT 
              id,
              type,
              status,
              progress,
              current_step as "currentStep",
              total_steps as "totalSteps",
              completed_steps as "completedSteps",
              data,
              error,
              created_at as "createdAt",
              started_at as "startedAt",
              completed_at as "completedAt",
              estimated_duration as "estimatedDuration"
            FROM background_jobs
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `;
      
      // Convert async generator to array and parse JSON data
      const jobs: BackgroundJob[] = [];
      for await (const job of jobsResult) {
        jobs.push({
          ...job,
          data: typeof job.data === 'string' ? JSON.parse(job.data) : job.data
        });
      }
      
      const jobsWithParsedData = jobs;
      
      return { jobs: jobsWithParsedData };
    } catch (error: any) {
      throw APIError.internal("Failed to list background jobs", error as Error);
    }
  }
);

export const getBackgroundJob = api<{ id: string }, GetBackgroundJobResponse>(
  { expose: true, method: "GET", path: "/ftp/background-jobs/:id" },
  async ({ id }) => {
    try {
      const job = await db.queryRow<BackgroundJob>`
        SELECT 
          id,
          type,
          status,
          progress,
          current_step as "currentStep",
          total_steps as "totalSteps",
          completed_steps as "completedSteps",
          data,
          error,
          created_at as "createdAt",
          started_at as "startedAt",
          completed_at as "completedAt",
          estimated_duration as "estimatedDuration"
        FROM background_jobs
        WHERE id = ${id}
      `;
      
      if (!job) {
        throw APIError.notFound("Background job not found");
      }
      
      // Parse JSON data
      const jobWithParsedData = {
        ...job,
        data: typeof job.data === 'string' ? JSON.parse(job.data) : job.data
      };
      
      return { job: jobWithParsedData };
    } catch (error: any) {
      if (error instanceof APIError) throw error;
      throw APIError.internal("Failed to get background job", error as Error);
    }
  }
);

export const updateBackgroundJob = api<UpdateBackgroundJobRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/ftp/background-jobs/:id" },
  async (req) => {
    try {
      // Utilisons des requêtes séparées pour éviter les problèmes de template strings dynamiques
      if (req.status !== undefined) {
        await db.exec`UPDATE background_jobs SET status = ${req.status} WHERE id = ${req.id}`;
        
        if (req.status === 'running') {
          await db.exec`UPDATE background_jobs SET started_at = NOW() WHERE id = ${req.id}`;
        } else if (['completed', 'failed', 'cancelled'].includes(req.status)) {
          await db.exec`UPDATE background_jobs SET completed_at = NOW() WHERE id = ${req.id}`;
        }
      }
      
      if (req.progress !== undefined) {
        await db.exec`UPDATE background_jobs SET progress = ${req.progress} WHERE id = ${req.id}`;
      }
      
      if (req.currentStep !== undefined) {
        await db.exec`UPDATE background_jobs SET current_step = ${req.currentStep} WHERE id = ${req.id}`;
      }
      
      if (req.completedSteps !== undefined) {
        await db.exec`UPDATE background_jobs SET completed_steps = ${req.completedSteps} WHERE id = ${req.id}`;
      }
      
      if (req.error !== undefined) {
        await db.exec`UPDATE background_jobs SET error = ${req.error} WHERE id = ${req.id}`;
      }
      
      return { success: true };
    } catch (error: any) {
      throw APIError.internal("Failed to update background job", error as Error);
    }
  }
);

export const cancelBackgroundJob = api<{ id: string }, { success: boolean }>(
  { expose: true, method: "POST", path: "/ftp/background-jobs/:id/cancel" },
  async ({ id }) => {
    try {
      await db.exec`
        UPDATE background_jobs 
        SET status = 'cancelled', completed_at = NOW()
        WHERE id = ${id} AND status IN ('pending', 'running')
      `;
      
      return { success: true };
    } catch (error: any) {
      throw APIError.internal("Failed to cancel background job", error as Error);
    }
  }
);