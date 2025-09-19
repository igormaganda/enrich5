export interface DownloadRequest {
  jobId: string;
  format?: 'zip' | 'rar' | 'csv'; // Format du téléchargement
}

export interface PreviewRequest {
  jobId: string;
  limit?: number; // Nombre de lignes à prévisualiser (défaut: 5)
}

export interface PreviewResponse {
  headers: string[];
  rows: string[][];
  totalRows: number;
  hasMore: boolean;
}

export interface DownloadResponse {
  content: string; // Base64 encoded file content
  filename: string;
  mimeType: string;
}

export interface FileInfo {
  filename: string;
  content: string; // Base64 encoded content
  mimeType: string;
  r2Url?: string;
}