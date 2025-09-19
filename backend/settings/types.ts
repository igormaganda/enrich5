export interface AppSettings {
  // Configuration Email
  emailSettings: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    fromAddress: string;
    fromName: string;
    enableNotifications: boolean;
  };
  
  // Configuration de traitement
  processingSettings: {
    maxConcurrentJobs: number;
    defaultTimeout: number; // en minutes
    autoRefreshInterval: number; // en secondes
    retryAttempts: number;
    enableAutoCleanup: boolean;
    cleanupAfterDays: number;
  };
  
  // Configuration des fichiers
  fileSettings: {
    maxFileSize: number; // en MB
    allowedFormats: string[];
    separator: string;
    compressionFormat: 'zip' | 'rar' | 'both';
    enablePreview: boolean;
    previewRowLimit: number;
  };
  
  // Configuration UI
  uiSettings: {
    appName: string;
    appDescription: string;
    theme: 'light' | 'dark' | 'auto';
    language: 'fr' | 'en';
    enableAnimations: boolean;
    itemsPerPage: number;
  };
  
  // Configuration système
  systemSettings: {
    enableDebugLogs: boolean;
    enableMetrics: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  
  // Configuration FTP
  ftpSettings: {
    globalEnabled: boolean;
    defaultPollInterval: number; // en minutes
    maxConcurrentDownloads: number;
    downloadTimeout: number; // en secondes
    retryAttempts: number;
    retryDelay: number; // en secondes
    tempDirectory: string;
    enableNotifications: boolean;
  };
}

export interface GetSettingsRequest {
  // Optionnel: récupérer une section spécifique
  section?: keyof AppSettings;
}

export interface UpdateSettingsRequest {
  settings: Partial<AppSettings>;
}

export interface SettingsResponse {
  success: boolean;
  settings: AppSettings;
}

export interface ResetSettingsRequest {
  section?: keyof AppSettings; // Si spécifié, ne reset que cette section
}

export interface InitializeSettingsRequest {
  // Interface vide pour l'initialisation
}

export interface EnrichmentSource {
  id: number;
  name: string;
  filePath: string;
  hasHeaders: boolean;
  delimiter: string;
  mapping: Record<string, string>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnrichmentSourceRequest {
  name: string;
  filePath: string;
  hasHeaders: boolean;
  delimiter: string;
  mapping: Record<string, string>;
}

export interface UpdateEnrichmentSourceRequest {
  id: number;
  name?: string;
  filePath?: string;
  hasHeaders?: boolean;
  delimiter?: string;
  mapping?: Record<string, string>;
}

export interface GetEnrichmentSourceResponse {
  source: EnrichmentSource;
}

export interface ListEnrichmentSourcesResponse {
  sources: EnrichmentSource[];
}

export interface DeleteEnrichmentSourceRequest {
  id: number;
}

export interface PreviewEnrichmentSourceRequest {
  filePath: string;
  name: string;
  delimiter: string;
  hasHeaders: boolean;
  limit?: number;
}

export interface SourceConfiguration {
  id: string;
  name: string;
  mapping: Record<string, string>;
  delimiter: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSourceConfigurationRequest {
  name: string;
  mapping: Record<string, string>;
  delimiter: string;
}

export interface PreviewEnrichmentSourceResponse {
  headers: string[];
  rows: string[][];
  firstRow?: string[];
  totalRows: number;
  hasMore: boolean;
  savedConfiguration?: SourceConfiguration;
  fingerprint?: string;
}