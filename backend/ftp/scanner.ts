import { api } from "encore.dev/api";
import { db } from "./db";
import type { FtpServerConfig, FtpScanResult, FileDetail, ProcessedFile } from "./types";
import { createBackgroundJob, updateBackgroundJob } from "./background_jobs";
import { enrichment } from "~encore/clients";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import * as ftp from "basic-ftp";
import * as yauzl from "yauzl";
import { promisify } from "util";
import { createHash } from "crypto";

export const scanAllFtpServers = api<{}, { scanId: string }>(
  { expose: true, method: "POST", path: "/ftp/scan-all" },
  async () => {
    const jobResult = await createBackgroundJob({
      type: 'ftp_scan',
      data: { action: 'scan_all_servers' },
      estimatedDuration: 300 // 5 minutes estimées
    });

    // Démarrer le scan en arrière-plan (ne pas attendre)
    processAllFtpServers(jobResult.id).catch(error => {
      console.error('Error in FTP scan process:', error);
      updateBackgroundJob({
        id: jobResult.id,
        status: 'failed',
        error: error.message
      });
    });

    return { scanId: jobResult.id };
  }
);

export const scanFtpServer = api<{ serverId: string }, { scanId: string }>(
  { expose: true, method: "POST", path: "/ftp/scan/:serverId" },
  async ({ serverId }) => {
    const jobResult = await createBackgroundJob({
      type: 'ftp_scan',
      data: { action: 'scan_server', serverId },
      estimatedDuration: 60 // 1 minute estimée
    });

    // Démarrer le scan en arrière-plan
    processSingleFtpServer(serverId, jobResult.id).catch(error => {
      console.error(`Error scanning FTP server ${serverId}:`, error);
      updateBackgroundJob({
        id: jobResult.id,
        status: 'failed',
        error: error.message
      });
    });

    return { scanId: jobResult.id };
  }
);

async function processAllFtpServers(jobId: string): Promise<void> {
  await updateBackgroundJob({
    id: jobId,
    status: 'running',
    progress: 0,
    currentStep: 'Récupération des serveurs FTP actifs'
  });

  try {
    const serversResult = await db.query<FtpServerConfig>`
      SELECT 
        id,
        name,
        host,
        port,
        username,
        password,
        path,
        file_pattern as "filePattern",
        delete_after_download as "deleteAfterDownload",
        poll_interval as "pollInterval",
        enabled
      FROM ftp_servers
      WHERE enabled = true
    `;

    // Convert async generator to array
    const servers: FtpServerConfig[] = [];
    for await (const server of serversResult) {
      servers.push(server);
    }

    if (servers.length === 0) {
      await updateBackgroundJob({
        id: jobId,
        status: 'completed',
        progress: 100,
        currentStep: 'Aucun serveur FTP actif trouvé'
      });
      return;
    }

    let completedServers = 0;
    const totalServers = servers.length;

    for (const server of servers) {
      await updateBackgroundJob({
        id: jobId,
        progress: Math.floor((completedServers / totalServers) * 100),
        currentStep: `Scan du serveur: ${server.name}`,
        completedSteps: completedServers
      });

      try {
        await scanSingleServer(server);
      } catch (error) {
        console.error(`Error scanning server ${server.name}:`, error);
      }

      completedServers++;
    }

    await updateBackgroundJob({
      id: jobId,
      status: 'completed',
      progress: 100,
      currentStep: `Scan terminé pour ${totalServers} serveur(s)`
    });

  } catch (error: any) {
    await updateBackgroundJob({
      id: jobId,
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}

async function processSingleFtpServer(serverId: string, jobId: string): Promise<void> {
  await updateBackgroundJob({
    id: jobId,
    status: 'running',
    progress: 0,
    currentStep: 'Récupération des informations du serveur'
  });

  try {
    const server = await db.queryRow<FtpServerConfig>`
      SELECT 
        id,
        name,
        host,
        port,
        username,
        password,
        path,
        file_pattern as "filePattern",
        delete_after_download as "deleteAfterDownload",
        poll_interval as "pollInterval",
        enabled
      FROM ftp_servers
      WHERE id = ${serverId}
    `;

    if (!server) {
      throw new Error('Serveur FTP non trouvé');
    }

    if (!server.enabled) {
      await updateBackgroundJob({
        id: jobId,
        status: 'completed',
        progress: 100,
        currentStep: 'Serveur désactivé'
      });
      return;
    }

    await updateBackgroundJob({
      id: jobId,
      progress: 25,
      currentStep: `Connexion au serveur: ${server.name}`
    });

    await scanSingleServer(server);

    await updateBackgroundJob({
      id: jobId,
      status: 'completed',
      progress: 100,
      currentStep: 'Scan terminé'
    });

  } catch (error: any) {
    await updateBackgroundJob({
      id: jobId,
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}

async function scanSingleServer(server: FtpServerConfig): Promise<FtpScanResult> {
  const scanStartedAt = new Date().toISOString();
  let filesFound = 0;
  let filesDownloaded = 0;
  const errors: string[] = [];
  const fileDetails: FileDetail[] = [];

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log(`Scanning FTP server: ${server.name} (${server.host}:${server.port})`);
    
    // Connexion au serveur FTP
    await client.access({
      host: server.host,
      port: server.port,
      user: server.username,
      password: server.password,
      secure: false
    });

    // Naviguer vers le répertoire spécifié
    if (server.path && server.path !== '/') {
      await client.cd(server.path);
    }

    // Lister les fichiers correspondant au pattern
    const fileList = await client.list();
    const matchingFiles = fileList.filter(file => {
      if (file.isDirectory) return false;
      return matchFilePattern(file.name, server.filePattern);
    });

    filesFound = matchingFiles.length;
    console.log(`Found ${filesFound} matching files`);

    for (const fileInfo of matchingFiles) {
      try {
        const fileDetail = await downloadAndProcessFile(client, server, fileInfo);
        fileDetails.push(fileDetail);
        filesDownloaded++;
        
        // Déclencher le traitement du fichier téléchargé
        await triggerFileProcessing(fileDetail.downloadPath, server.id, fileDetail.name, fileDetail);
      } catch (error: any) {
        errors.push(`Erreur téléchargement ${fileInfo.name}: ${error.message}`);
        console.error(`Error downloading ${fileInfo.name}:`, error);
      }
    }

    await client.close();

    // Enregistrer le résultat du scan
    await db.exec`
      INSERT INTO ftp_scan_logs (server_id, files_found, files_downloaded, file_details, errors, scan_completed_at)
      VALUES (${server.id}, ${filesFound}, ${filesDownloaded}, ${JSON.stringify(fileDetails)}, ${JSON.stringify(errors)}, NOW())
    `;

    const scanCompletedAt = new Date().toISOString();

    return {
      serverId: server.id,
      serverName: server.name,
      filesFound,
      filesDownloaded,
      fileDetails,
      errors,
      scanStartedAt,
      scanCompletedAt
    };

  } catch (error: any) {
    errors.push(`Erreur générale: ${error.message}`);
    console.error(`Error scanning server ${server.name}:`, error);
    
    try {
      await client.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    await db.exec`
      INSERT INTO ftp_scan_logs (server_id, files_found, files_downloaded, file_details, errors, scan_completed_at)
      VALUES (${server.id}, ${filesFound}, ${filesDownloaded}, ${JSON.stringify(fileDetails)}, ${JSON.stringify(errors)}, NOW())
    `;

    throw error;
  }
}

async function downloadAndProcessFile(client: ftp.Client, server: FtpServerConfig, fileInfo: ftp.FileInfo): Promise<FileDetail> {
  // Créer un répertoire temporaire pour les téléchargements
  const tempDir = path.join(os.tmpdir(), 'ftp-downloads');
  await fs.mkdir(tempDir, { recursive: true });
  
  const localFilePath = path.join(tempDir, `${server.id}_${fileInfo.name}`);
  
  console.log(`Downloading ${fileInfo.name} (${formatFileSize(fileInfo.size)}) from ${server.name}`);
  
  // Télécharger le fichier
  await client.downloadTo(localFilePath, fileInfo.name);
  
  // Vérifier la taille réelle du fichier téléchargé
  const stats = await fs.stat(localFilePath);
  const actualSize = stats.size;
  
  // Déterminer le format du fichier
  const fileExtension = path.extname(fileInfo.name).toLowerCase();
  const format = fileExtension.substring(1) || 'unknown';
  const isZip = format === 'zip';
  
  const fileDetail: FileDetail = {
    name: fileInfo.name,
    size: actualSize,
    format,
    isZip,
    downloadPath: localFilePath,
    downloadedAt: new Date().toISOString()
  };
  
  // Si c'est un fichier ZIP, l'extraire
  if (isZip) {
    try {
      const extractedFiles = await extractZipFile(localFilePath);
      fileDetail.extractedFiles = extractedFiles;
      console.log(`Extracted ${extractedFiles.length} files from ${fileInfo.name}`);
    } catch (error: any) {
      console.error(`Error extracting ZIP ${fileInfo.name}:`, error);
      throw new Error(`Erreur extraction ZIP: ${error.message}`);
    }
  }
  
  console.log(`Downloaded: ${fileInfo.name} (${format.toUpperCase()}, ${formatFileSize(actualSize)})`);
  
  return fileDetail;
}

function matchFilePattern(fileName: string, pattern: string): boolean {
  // Convertir le pattern en regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(fileName);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

async function extractZipFile(zipPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const extractedFiles: string[] = [];
    const extractDir = path.join(path.dirname(zipPath), path.basename(zipPath, '.zip') + '_extracted');
    
    // Créer le répertoire d'extraction
    fs.mkdir(extractDir, { recursive: true }).then(() => {
      yauzl.open(zipPath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!zipfile) {
          reject(new Error('Failed to open ZIP file'));
          return;
        }
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry: any) => {
          // Skip directories
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }
          
          // Extract file
          zipfile.openReadStream(entry, (err: any, readStream: any) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (!readStream) {
              zipfile.readEntry();
              return;
            }
            
            const extractedPath = path.join(extractDir, entry.fileName);
            
            // Créer les répertoires parents si nécessaire
            fs.mkdir(path.dirname(extractedPath), { recursive: true }).then(() => {
              const writeStream = fsSync.createWriteStream(extractedPath);
              
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                extractedFiles.push(entry.fileName);
                zipfile.readEntry();
              });
              
              writeStream.on('error', (err: any) => {
                reject(err);
              });
            }).catch(reject);
          });
        });
        
        zipfile.on('end', () => {
          resolve(extractedFiles);
        });
        
        zipfile.on('error', (err: any) => {
          reject(err);
        });
      });
    }).catch(reject);
  });
}

async function findOrCreateEnrichmentSource(serverId: string, fileName: string): Promise<{ id: number } | null> {
  try {
    // Récupérer le nom du serveur FTP pour créer un nom descriptif
    const ftpServer = await db.queryRow<{ name: string }>`
      SELECT name FROM ftp_servers WHERE id = ${serverId}
    `;
    
    if (!ftpServer) {
      console.error(`FTP server with ID ${serverId} not found`);
      return null;
    }
    
    // Créer un nom unique pour la source d'enrichissement
    const sourceName = `FTP_${ftpServer.name}_${fileName}_${Date.now()}`;
    
    // Créer ou trouver la source d'enrichissement
    const existingSource = await db.queryRow<{ id: number }>`
      SELECT id FROM enrichment_sources 
      WHERE name = ${sourceName}
    `;
    
    if (existingSource) {
      return existingSource;
    }
    
    // Créer une nouvelle source d'enrichissement
    const newSource = await db.queryRow<{ id: number }>`
      INSERT INTO enrichment_sources (name, file_path, has_headers, delimiter, mapping)
      VALUES (${sourceName}, '/tmp/ftp_files', true, ',', '{}')
      RETURNING id
    `;
    
    console.log(`Created new enrichment source with ID ${newSource?.id} for FTP server ${ftpServer.name}`);
    return newSource;
    
  } catch (error) {
    console.error('Error finding or creating enrichment source:', error);
    return null;
  }
}

async function triggerFileProcessing(filePath: string, serverId: string, fileName: string, fileDetail: FileDetail): Promise<boolean> {
  try {
    // Pour les fichiers FTP, nous devons créer ou trouver un enrichment source correspondant
    // au serveur FTP. Nous utiliserons le serverId UUID comme identifiant unique.
    const enrichmentSource = await findOrCreateEnrichmentSource(serverId, fileName);
    
    if (!enrichmentSource) {
      throw new Error(`Failed to create or find enrichment source for server ${serverId}`);
    }

    // Si c'est un ZIP extrait, traiter les fichiers extraits
    if (fileDetail.isZip && fileDetail.extractedFiles && fileDetail.extractedFiles.length > 0) {
      console.log(`Processing ${fileDetail.extractedFiles.length} extracted files from ${fileName}`);
      
      let allSuccess = true;
      for (const extractedFileName of fileDetail.extractedFiles) {
        const extractedPath = path.join(
          path.dirname(filePath), 
          path.basename(filePath, '.zip') + '_extracted',
          extractedFileName
        );
        
        try {
          const result = await enrichment.startCompleteEnrichment({
            filePath: extractedPath,
            fileName: extractedFileName,
            serverId
          });
          
          console.log(`Created background processing job for extracted file ${extractedFileName}`);
        } catch (error) {
          console.error(`Failed to process extracted file ${extractedFileName}:`, error);
          allSuccess = false;
        }
      }
      return allSuccess;
    } else {
      const result = await enrichment.startCompleteEnrichment({
        filePath,
        fileName,
        serverId
      });
      
      console.log(`Created background processing job for ${fileName}`);
      return true;
    }
  } catch (error) {
    console.error(`Failed to trigger file processing for ${fileName}:`, error);
    return false;
  }
}

async function isFileAlreadyProcessed(serverId: string, fileName: string, fileSize: number): Promise<boolean> {
  try {
    const result = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM processed_files
      WHERE server_id = ${serverId}
        AND file_name = ${fileName}
        AND file_size = ${fileSize}
        AND processing_status IN ('success', 'skipped')
    `;
    
    return (result?.count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking if file already processed:', error);
    return false;
  }
}

async function recordProcessedFile(
  serverId: string, 
  fileDetail: FileDetail, 
  status: 'success' | 'failed' | 'skipped',
  errorMessage?: string
): Promise<void> {
  try {
    // Calculer le hash du fichier si possible
    let fileHash: string | undefined;
    if (fileDetail.downloadPath && fsSync.existsSync(fileDetail.downloadPath)) {
      try {
        const fileContent = await fs.readFile(fileDetail.downloadPath);
        const hash = createHash('md5');
        hash.update(fileContent);
        fileHash = hash.digest('hex');
      } catch (hashError) {
        console.error('Error calculating file hash:', hashError);
      }
    }

    await db.exec`
      INSERT INTO processed_files (
        server_id, file_name, file_size, file_hash,
        processing_status, error_message, deleted_from_ftp
      )
      VALUES (
        ${serverId}, ${fileDetail.name}, ${fileDetail.size}, ${fileHash},
        ${status}, ${errorMessage || null}, false
      )
      ON CONFLICT (server_id, file_name, file_size)
      DO UPDATE SET
        processing_status = EXCLUDED.processing_status,
        error_message = EXCLUDED.error_message,
        processed_at = NOW()
    `;
    
    console.log(`Recorded processed file: ${fileDetail.name} (${status})`);
  } catch (error) {
    console.error('Error recording processed file:', error);
  }
}

async function markFileDeletedFromFtp(serverId: string, fileName: string, fileSize: number): Promise<void> {
  try {
    await db.exec`
      UPDATE processed_files
      SET deleted_from_ftp = true
      WHERE server_id = ${serverId}
        AND file_name = ${fileName}
        AND file_size = ${fileSize}
    `;
  } catch (error) {
    console.error('Error marking file as deleted from FTP:', error);
  }
}