import { api, APIError } from "encore.dev/api";
import { downloadDB } from "./db";
import type { DownloadRequest, DownloadResponse, FileInfo, PreviewRequest, PreviewResponse } from "./types";
import { settings } from '~encore/clients';

// Preview enriched data (first few lines)
export const previewResults = api<PreviewRequest, PreviewResponse>(
  { expose: true, method: "GET", path: "/preview/:jobId" },
  async (req) => {
    try {
      const result = await downloadDB.queryRow<{ 
        result_data: any;
      }>`
        SELECT result_data FROM job_results WHERE job_id = ${req.jobId}
      `;

      if (!result) {
        throw APIError.notFound("Results not found for this job.");
      }

      const results = result.result_data;
      const limit = req.limit || 5;
      const headers = Object.keys(results[0] || {});
      const rows = results.slice(0, limit).map((row: any) => Object.values(row));
      const totalRows = results.length;

      return {
        headers,
        rows,
        totalRows,
        hasMore: totalRows > limit
      };
    } catch (error) {
      throw APIError.internal("Failed to preview results", error as Error);
    }
  }
);

// Downloads enriched files directly
export const downloadFile = api<DownloadRequest, DownloadResponse>(
  { expose: true, method: "GET", path: "/download/:jobId" },
  async (req) => {
    try {
      const fileSettings = (await settings.getSettings({ section: 'fileSettings' })).settings.fileSettings;
      const result = await downloadDB.queryRow<{ 
        result_data: any;
      }>`
        SELECT result_data FROM job_results WHERE job_id = ${req.jobId}
      `;

      if (!result) {
        throw APIError.notFound("Results not found for this job.");
      }

      const job = await downloadDB.queryRow<{filename: string}>`SELECT filename FROM job_history WHERE job_id = ${req.jobId}`;
      if (!job) {
        throw APIError.notFound("Job not found");
      }

      const results = result.result_data;
      const headers = Object.keys(results[0] || {});
      const csvContent = [
        headers.join(fileSettings.separator),
        ...results.map((row: any) => Object.values(row).join(fileSettings.separator))
      ].join('\n');

      // Create downloadable file based on format
      const format = req.format || 'zip';
      const fileContent = await createDownloadFile(csvContent, job.filename, format);
      const downloadFilename = `enriched_${job.filename.replace(/(\.[^/.]+)$/, '')}.${format}`;
      
      return {
        content: Buffer.from(fileContent).toString('base64'),
        filename: downloadFilename,
        mimeType: getMimeType(format)
      };
    } catch (error) {
      throw APIError.internal("Failed to download file", error as Error);
    }
  }
);



// Get download info (filename, size, etc.) without downloading
export const getDownloadInfo = api<DownloadRequest, FileInfo>(
  { expose: true, method: "GET", path: "/download-info/:jobId" },
  async (req) => {
    try {
      const fileSettings = (await settings.getSettings({ section: 'fileSettings' })).settings.fileSettings;
      const job = await downloadDB.queryRow<{ 
        filename: string;
        fileType: string;
        status: string;
        r2Url: string | null;
      }>`
        SELECT filename, file_type as "fileType", status, r2_url as "r2Url"
        FROM job_history 
        WHERE job_id = ${req.jobId}
      `;

      if (!job) {
        throw APIError.notFound("Job not found");
      }

      if (job.status !== 'completed') {
        throw APIError.failedPrecondition("Job not completed yet");
      }

      const format = req.format || 'zip';
      const downloadFilename = `enriched_${job.filename.replace(/(\.[^/.]+)$/, '')}.${format}`;
      
      return {
        filename: downloadFilename,
        content: "", // Will be populated by download endpoint
        mimeType: getMimeType(format),
        r2Url: job.r2Url || undefined
      };
    } catch (error) {
      throw APIError.internal("Failed to get download info", error as Error);
    }
  }
);



async function createDownloadFile(csvContent: string, originalFilename: string, format: string): Promise<string> {
  const filename = originalFilename.replace(/(\.[^/.]+)$/, '');
  const enrichedFilename = `enriched_${filename}.csv`;

  switch (format) {
    case 'csv':
      // Return raw CSV
      return csvContent;
      
    case 'zip':
      // Create a simple ZIP-like structure (simplified for demo)
      const zipHeader = `PK\x05\x06\x00\x00\x00\x00\x01\x00\x01\x00\x42\x00\x00\x00\x42\x00\x00\x00\x00\x00`;
      const fileEntry = `PK\x01\x02\x14\x00\x14\x00\x08\x00\x08\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00${enrichedFilename}\n`;
      return zipHeader + fileEntry + csvContent;
      
    case 'rar':
      // Create a simple RAR-like structure (simplified for demo)  
      const rarHeader = `Rar!\x1A\x07\x00cf\x90s\x00\x00\x0D\x00\x00\x00\x00\x00\x00\x00`;
      const fileHeader = `\n\n---\nFile: ${enrichedFilename}\n\n`;
      return rarHeader + fileHeader + csvContent;
      
    default:
      return csvContent;
  }
}

function getMimeType(format: string): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/x-rar-compressed';
    default:
      return 'application/octet-stream';
  }
}


