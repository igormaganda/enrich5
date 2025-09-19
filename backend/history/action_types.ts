export interface CancelJobRequest {
  jobId: string;
}

export interface DeleteJobRequest {
  jobId: string;
}

export interface JobActionResponse {
  success: boolean;
  message: string;
}