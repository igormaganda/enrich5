export interface UploadRequest {
  filename: string;
  fileType: string;
  userId: string;
}

export interface UploadResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface FileUploadRequest {
  filename: string;
  fileSize: number; // Size in bytes
  userId: string;
  isArchive: boolean; // Indicates if this is an archive that needs extraction
  fileData?: string; // base64 encoded file content
}

export type FileType = 'FTTH' | '4GBOX' | 'Mobile' | 'Blacklist';

export interface JobHistoryEntry {
  id: number;
  jobId: string;
  filename: string;
  status: string;
  fileType: string;
  recordsProcessed: number;
  recordsEnriched: number;
  errorMessage?: string;
  r2Url?: string;
  startedAt: Date;
  completedAt?: Date;
  createdBy: string;
}
