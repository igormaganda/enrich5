import { api, APIError } from "encore.dev/api";
import { db } from "./db";
import type { ProcessedFile } from "./types";

export interface ListProcessedFilesRequest {
  serverId?: string;
  status?: 'success' | 'failed' | 'skipped';
  limit?: number;
  offset?: number;
}

export interface ListProcessedFilesResponse {
  files: ProcessedFile[];
  total: number;
}

export interface CleanupProcessedFilesRequest {
  serverId?: string;
  olderThanDays: number;
}

export interface CleanupProcessedFilesResponse {
  deletedCount: number;
}

export const listProcessedFiles = api<ListProcessedFilesRequest, ListProcessedFilesResponse>(
  { expose: true, method: "GET", path: "/ftp/processed-files" },
  async (req) => {
    try {
      const limit = req.limit || 50;
      const offset = req.offset || 0;
      

      
      // Récupérer le total
      let totalResult;
      if (req.serverId && req.status) {
        totalResult = await db.queryRow<{ count: number }>`
          SELECT COUNT(*) as count
          FROM processed_files
          WHERE server_id = ${req.serverId} AND processing_status = ${req.status}
        `;
      } else if (req.serverId) {
        totalResult = await db.queryRow<{ count: number }>`
          SELECT COUNT(*) as count
          FROM processed_files
          WHERE server_id = ${req.serverId}
        `;
      } else if (req.status) {
        totalResult = await db.queryRow<{ count: number }>`
          SELECT COUNT(*) as count
          FROM processed_files
          WHERE processing_status = ${req.status}
        `;
      } else {
        totalResult = await db.queryRow<{ count: number }>`
          SELECT COUNT(*) as count
          FROM processed_files
        `;
      }
      const total = totalResult?.count || 0;
      
      // Récupérer les fichiers
      let filesResult;
      if (req.serverId && req.status) {
        filesResult = await db.query<ProcessedFile>`
          SELECT 
            id,
            server_id as "serverId",
            file_name as "fileName",
            file_size as "fileSize",
            file_hash as "fileHash",
            processed_at as "processedAt",
            processing_status as "processingStatus",
            processing_job_id as "processingJobId",
            error_message as "errorMessage",
            deleted_from_ftp as "deletedFromFtp"
          FROM processed_files
          WHERE server_id = ${req.serverId} AND processing_status = ${req.status}
          ORDER BY processed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (req.serverId) {
        filesResult = await db.query<ProcessedFile>`
          SELECT 
            id,
            server_id as "serverId",
            file_name as "fileName",
            file_size as "fileSize",
            file_hash as "fileHash",
            processed_at as "processedAt",
            processing_status as "processingStatus",
            processing_job_id as "processingJobId",
            error_message as "errorMessage",
            deleted_from_ftp as "deletedFromFtp"
          FROM processed_files
          WHERE server_id = ${req.serverId}
          ORDER BY processed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (req.status) {
        filesResult = await db.query<ProcessedFile>`
          SELECT 
            id,
            server_id as "serverId",
            file_name as "fileName",
            file_size as "fileSize",
            file_hash as "fileHash",
            processed_at as "processedAt",
            processing_status as "processingStatus",
            processing_job_id as "processingJobId",
            error_message as "errorMessage",
            deleted_from_ftp as "deletedFromFtp"
          FROM processed_files
          WHERE processing_status = ${req.status}
          ORDER BY processed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        filesResult = await db.query<ProcessedFile>`
          SELECT 
            id,
            server_id as "serverId",
            file_name as "fileName",
            file_size as "fileSize",
            file_hash as "fileHash",
            processed_at as "processedAt",
            processing_status as "processingStatus",
            processing_job_id as "processingJobId",
            error_message as "errorMessage",
            deleted_from_ftp as "deletedFromFtp"
          FROM processed_files
          ORDER BY processed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      
      const files: ProcessedFile[] = [];
      for await (const file of filesResult) {
        files.push(file);
      }
      
      return { files, total };
    } catch (error: any) {
      throw APIError.internal("Failed to list processed files", error as Error);
    }
  }
);

export const getProcessedFile = api<{ id: string }, { file: ProcessedFile }>(
  { expose: true, method: "GET", path: "/ftp/processed-files/:id" },
  async ({ id }) => {
    try {
      const file = await db.queryRow<ProcessedFile>`
        SELECT 
          id,
          server_id as "serverId",
          file_name as "fileName",
          file_size as "fileSize",
          file_hash as "fileHash",
          processed_at as "processedAt",
          processing_status as "processingStatus",
          processing_job_id as "processingJobId",
          error_message as "errorMessage",
          deleted_from_ftp as "deletedFromFtp"
        FROM processed_files
        WHERE id = ${id}
      `;
      
      if (!file) {
        throw APIError.notFound("Processed file not found");
      }
      
      return { file };
    } catch (error: any) {
      if (error instanceof APIError) throw error;
      throw APIError.internal("Failed to get processed file", error as Error);
    }
  }
);

export const cleanupProcessedFiles = api<CleanupProcessedFilesRequest, CleanupProcessedFilesResponse>(
  { expose: true, method: "DELETE", path: "/ftp/processed-files/cleanup" },
  async (req) => {
    try {
      // Compter d'abord les lignes à supprimer
      let countResult;
      if (req.serverId) {
        countResult = await db.queryRow<{ count: number }>`
          SELECT COUNT(*) as count FROM processed_files 
          WHERE processed_at < NOW() - INTERVAL '${req.olderThanDays} days'
          AND server_id = ${req.serverId}
        `;
      } else {
        countResult = await db.queryRow<{ count: number }>`
          SELECT COUNT(*) as count FROM processed_files 
          WHERE processed_at < NOW() - INTERVAL '${req.olderThanDays} days'
        `;
      }
      
      const deletedCount = countResult?.count || 0;
      
      // Supprimer les lignes
      if (req.serverId) {
        await db.exec`
          DELETE FROM processed_files 
          WHERE processed_at < NOW() - INTERVAL '${req.olderThanDays} days'
          AND server_id = ${req.serverId}
        `;
      } else {
        await db.exec`
          DELETE FROM processed_files 
          WHERE processed_at < NOW() - INTERVAL '${req.olderThanDays} days'
        `;
      }
      
      return { deletedCount };
    } catch (error: any) {
      throw APIError.internal("Failed to cleanup processed files", error as Error);
    }
  }
);

export const retryFailedFile = api<{ id: string }, { success: boolean }>(
  { expose: true, method: "POST", path: "/ftp/processed-files/:id/retry" },
  async ({ id }) => {
    try {
      // Marquer le fichier comme non traité pour qu'il soit repris au prochain scan
      await db.exec`
        DELETE FROM processed_files
        WHERE id = ${id} AND processing_status = 'failed'
      `;
      
      return { success: true };
    } catch (error: any) {
      throw APIError.internal("Failed to retry failed file", error as Error);
    }
  }
);