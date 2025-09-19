export interface FtpServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  path: string; // Chemin sur le serveur FTP où chercher les fichiers
  enabled: boolean;
  filePattern: string; // Pattern des fichiers à télécharger (ex: "*.csv", "*.zip")
  deleteAfterDownload: boolean;
  pollInterval: number; // Intervalle en minutes pour scanner le serveur
  createdAt: string;
  updatedAt: string;
}

export interface CreateFtpServerRequest {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  path: string;
  filePattern: string;
  deleteAfterDownload: boolean;
  pollInterval: number;
}

export interface UpdateFtpServerRequest {
  id: string;
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  path?: string;
  filePattern?: string;
  deleteAfterDownload?: boolean;
  pollInterval?: number;
  enabled?: boolean;
}

export interface ListFtpServersResponse {
  servers: FtpServerConfig[];
}

export interface GetFtpServerResponse {
  server: FtpServerConfig;
}

export interface DeleteFtpServerRequest {
  id: string;
}

export interface TestFtpConnectionRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  path?: string;
}

export interface TestFtpConnectionResponse {
  success: boolean;
  message: string;
  files?: string[];
}

export interface FileDetail {
  name: string;
  size: number;
  format: string;
  isZip: boolean;
  extractedFiles?: string[]; // Si c'est un ZIP, liste des fichiers extraits
  downloadPath: string;
  downloadedAt: string;
}

export interface FtpScanResult {
  serverId: string;
  serverName: string;
  filesFound: number;
  filesDownloaded: number;
  fileDetails: FileDetail[];
  errors: string[];
  scanStartedAt: string;
  scanCompletedAt: string;
}

export interface BackgroundJob {
  id: string;
  type: 'ftp_scan' | 'file_processing' | 'enrichment';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  data: any; // Données spécifiques au job
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number; // en secondes
}

export interface CreateBackgroundJobRequest {
  type: BackgroundJob['type'];
  data: any;
  estimatedDuration?: number;
}

export interface UpdateBackgroundJobRequest {
  id: string;
  status?: BackgroundJob['status'];
  progress?: number;
  currentStep?: string;
  completedSteps?: number;
  error?: string;
}

export interface ListBackgroundJobsResponse {
  jobs: BackgroundJob[];
}

export interface GetBackgroundJobResponse {
  job: BackgroundJob;
}

export interface ProcessedFile {
  id: string;
  serverId: string;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  processedAt: string;
  processingStatus: 'success' | 'failed' | 'skipped';
  processingJobId?: string;
  errorMessage?: string;
  deletedFromFtp: boolean;
}