export interface SendCompletionEmailRequest {
  userId: string;
  jobId: string;
  filename: string;
  recordsProcessed: number;
  recordsEnriched: number;
  downloadUrl: string;
}

export interface SendErrorEmailRequest {
  userId: string;
  jobId: string;
  filename: string;
  errorMessage: string;
}

export interface TestEmailRequest {
  to: string;
  testType?: 'completion' | 'error';
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
}
