export interface JobHistoryEntry {
  id: number;
  jobId: string;
  sourceId?: string;
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

export interface GetHistoryRequest {
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface GetHistoryResponse {
  jobs: JobHistoryEntry[];
  total: number;
}
