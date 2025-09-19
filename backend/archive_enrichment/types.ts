export interface ArchiveProcessingRequest {
  archiveBuffer: string; // Base64 encoded archive
  fileName: string;
  userId: number;
}

export interface ArchiveProcessingResponse {
  success: boolean;
  archiveJobId: string;
  message: string;
}

export interface ArchiveJob {
  id: string;
  userId: number;
  archiveName: string;
  status: "processing" | "enriching" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  downloadUrl?: string;
}

export interface TempArchiveData {
  id: string;
  archiveJobId: string;
  fileName: string;
  fileType: string;
  rowData: any;
  hexacleHash?: string;
  isEnriched: boolean;
  enrichedData?: any;
  createdAt: Date;
}

export interface EnrichmentMatch {
  hexacleHash: string;
  contactData: any;
}

export interface BlacklistEntry {
  mobilePhone: string;
  [key: string]: any;
}