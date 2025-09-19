import { api, APIError } from "encore.dev/api";
import type { FileUploadRequest, UploadResponse, FileType } from "./types";
import { v4 as uuidv4 } from "uuid";
import { history, enrichment } from "~encore/clients";
import { Readable } from 'stream';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Uploads a file for processing
export const uploadFiles = api.raw(
  { expose: true, method: 'POST', path: '/upload' },
  async (req, resp) => {
    const jobId = uuidv4();
    
    return new Promise<void>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      const fields: Record<string, string> = {};
      let filePath = '';
      let filename = '';

      busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
      });

      busboy.on('file', (fieldname, file, info) => {
        filename = info.filename;
        const tmpDir = path.join(os.tmpdir(), 'uploads');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        filePath = path.join(tmpDir, `${jobId}-${filename}`);
        const writeStream = fs.createWriteStream(filePath);
        file.pipe(writeStream);
      });

      busboy.on('finish', async () => {
        const userId = fields.userId;
        const fileType = determineFileType(filename);

        try {
          await history.createJob({ 
            jobId, 
            filename, 
            fileType, 
            userId 
          });

          // Start the enrichment process in the background
          enrichment.startImport({ sourceId: 1 }).catch((err: any) => {
            console.error(`Failed to process job ${jobId}:`, err);
            history.updateJobStatus({ jobId, status: 'failed', errorMessage: 'Failed to start processing' });
          });

          const response: UploadResponse = {
            jobId,
            status: "queued",
            message: "File uploaded and queued for processing"
          };

          resp.statusCode = 200;
          resp.setHeader('Content-Type', 'application/json');
          resp.end(JSON.stringify(response));
          resolve();
        } catch (error) {
          console.error('Upload failed:', error);
          const apiError = APIError.internal('Failed to queue file for processing', error as Error);
          resp.statusCode = 500;
          resp.setHeader('Content-Type', 'application/json');
          resp.end(JSON.stringify({ message: apiError.message, code: apiError.code }));
          reject(apiError);
        }
      });

      req.pipe(busboy);

      busboy.on('error', (err) => {
        console.error('Busboy error:', err);
        const apiError = APIError.internal('Failed to parse upload stream', err as Error);
        resp.statusCode = 500;
        resp.setHeader('Content-Type', 'application/json');
        resp.end(JSON.stringify({ message: apiError.message, code: apiError.code }));
        reject(apiError);
      });
    });
  }
);

function determineFileType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('ftth')) return 'FTTH';
  if (lower.includes('4gbox')) return '4GBOX';
  if (lower.includes('mobile') && !lower.includes('blacklist')) return 'Mobile';
  if (lower.includes('blacklist')) return 'Blacklist';
  if (lower.endsWith('.zip') || lower.endsWith('.rar')) return 'Archive';
  
  // For CSV/XLSX files without specific identifiers, try to guess from structure
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx')) return 'Data';
  
  throw new Error(`Unable to determine file type from filename: ${filename}`);
}