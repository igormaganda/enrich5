export interface StartImportRequest {
  sourceId: number;
}

export interface StartImportResponse {
  success: boolean;
  jobId: string;
  recordsProcessed: number;
  error?: string;
}
