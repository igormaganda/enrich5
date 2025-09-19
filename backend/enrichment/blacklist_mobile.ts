import { api } from "encore.dev/api";
import { enrichmentDB as db } from "./db";
import fs from "fs/promises";
import csv from "csv-parser";
import { createReadStream } from "fs";
import { v4 as uuidv4 } from "uuid";

export interface ProcessBlacklistRequest {
  filePath: string;
  fileName: string;
}

export interface ProcessBlacklistResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export interface BlacklistJobStatus {
  id: string;
  file_name: string;
  total_numbers: number;
  processed_numbers: number;
  duplicate_numbers: number;
  status: string;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export const processBlacklistFile = api<ProcessBlacklistRequest, ProcessBlacklistResponse>(
  { expose: true, method: "POST", path: "/enrichment/process-blacklist" },
  async ({ filePath, fileName }) => {
    const jobId = uuidv4();
    
    try {
      // Créer l'entrée de job
      await db.exec`
        INSERT INTO blacklist_jobs (id, file_name, file_path, status)
        VALUES (${jobId}, ${fileName}, ${filePath}, 'pending')
      `;
      
      // Démarrer le traitement en arrière-plan
      processBlacklistInBackground(jobId, filePath, fileName).catch(async (error) => {
        console.error(`Blacklist job ${jobId} failed:`, error);
        await updateBlacklistJobStatus(jobId, 'failed', error.message);
      });
      
      return {
        success: true,
        jobId,
        message: `Blacklist processing started for ${fileName}`
      };
      
    } catch (error: any) {
      console.error('Failed to start blacklist processing:', error);
      return {
        success: false,
        jobId,
        message: `Failed to start blacklist processing: ${error.message}`
      };
    }
  }
);

export const getBlacklistJobStatus = api<{ jobId: string }, { job?: BlacklistJobStatus; error?: string }>(
  { expose: true, method: "GET", path: "/enrichment/blacklist-jobs/:jobId/status" },
  async ({ jobId }) => {
    const job = await db.queryRow<BlacklistJobStatus>`
      SELECT * FROM blacklist_jobs WHERE id = ${jobId}
    `;
    
    if (job) {
      return { job };
    } else {
      return { error: "Blacklist job not found" };
    }
  }
);

export const getBlacklistCount = api<void, { count: number }>(
  { expose: true, method: "GET", path: "/enrichment/blacklist/count" },
  async () => {
    const result = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM mobile_blacklist
    `;
    
    return { count: result?.count || 0 };
  }
);

export const clearBlacklist = api<void, { success: boolean; deleted: number }>(
  { expose: true, method: "DELETE", path: "/enrichment/blacklist/clear" },
  async () => {
    const countResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM mobile_blacklist
    `;
    
    await db.exec`DELETE FROM mobile_blacklist`;
    
    return { success: true, deleted: countResult?.count || 0 };
  }
);

async function processBlacklistInBackground(
  jobId: string,
  filePath: string,
  fileName: string
): Promise<void> {
  
  await updateBlacklistJobStatus(jobId, 'processing', null, new Date());
  
  try {
    console.log(`Starting blacklist processing for job ${jobId}: ${fileName}`);
    
    // Vérifier que le fichier existe
    await fs.access(filePath);
    
    // Détecter s'il y a des headers en lisant la première ligne
    const hasHeaders = await detectBlacklistHeaders(filePath);
    console.log(`Blacklist file ${fileName} has headers: ${hasHeaders}`);
    
    let totalNumbers = 0;
    let processedNumbers = 0;
    let duplicateNumbers = 0;
    
    const processedPhones = new Set<string>();
    
    const processingPromise = new Promise<{ total: number, processed: number, duplicates: number }>((resolve, reject) => {
      const stream = createReadStream(filePath);
      const parser = csv({ 
        separator: ';',
        headers: hasHeaders
      });
      
      let batch: string[] = [];
      const batchSize = 1000;
      
      stream.pipe(parser)
        .on('data', async (row) => {
          try {
            totalNumbers++;
            
            // Extraire le numéro de téléphone
            let phoneNumber: string;
            
            if (hasHeaders) {
              // Si headers, chercher dans les colonnes possibles
              phoneNumber = row.phone || row.mobile || row.numero || row.telephone || '';
            } else {
              // Sans headers, le numéro devrait être dans la première colonne
              phoneNumber = row[0] || '';
            }
            
            // Nettoyer le numéro
            phoneNumber = cleanPhoneNumber(phoneNumber);
            
            if (phoneNumber && phoneNumber.length >= 9) { // Au moins 9 chiffres
              if (!processedPhones.has(phoneNumber)) {
                processedPhones.add(phoneNumber);
                batch.push(phoneNumber);
                
                if (batch.length >= batchSize) {
                  await insertBlacklistBatch(batch, fileName);
                  processedNumbers += batch.length;
                  batch = [];
                  
                  // Mettre à jour le progrès
                  await updateBlacklistJobProgress(jobId, totalNumbers, processedNumbers, duplicateNumbers);
                }
              } else {
                duplicateNumbers++;
              }
            }
          } catch (error) {
            console.error('Error processing blacklist row:', error);
          }
        })
        .on('end', async () => {
          try {
            if (batch.length > 0) {
              await insertBlacklistBatch(batch, fileName);
              processedNumbers += batch.length;
            }
            resolve({ total: totalNumbers, processed: processedNumbers, duplicates: duplicateNumbers });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
    
    const result = await processingPromise;
    
    // Finaliser le job
    await updateBlacklistJobStatus(jobId, 'completed', null, null, new Date());
    await updateBlacklistJobProgress(jobId, result.total, result.processed, result.duplicates);
    
    console.log(`Blacklist processing completed for job ${jobId}: ${result.processed} numbers added, ${result.duplicates} duplicates skipped`);
    
  } catch (error: any) {
    console.error(`Error in blacklist processing for job ${jobId}:`, error);
    await updateBlacklistJobStatus(jobId, 'failed', error.message, null, new Date());
    throw error;
  }
}

async function detectBlacklistHeaders(filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    let firstLine = '';
    let hasReadFirstLine = false;
    
    stream.on('data', (chunk) => {
      if (!hasReadFirstLine) {
        firstLine += chunk.toString();
        const lineEnd = firstLine.indexOf('\\n');
        if (lineEnd !== -1) {
          firstLine = firstLine.substring(0, lineEnd);
          hasReadFirstLine = true;
          stream.destroy();
          
          // Vérifier si la première ligne contient des headers
          const firstLineClean = firstLine.trim().toLowerCase();
          const hasHeaders = firstLineClean.includes('phone') || 
                           firstLineClean.includes('mobile') || 
                           firstLineClean.includes('numero') ||
                           firstLineClean.includes('telephone') ||
                           (firstLineClean.split(';').length === 1 && !/^\\d+$/.test(firstLineClean.replace(/[^0-9]/g, '')));
          
          resolve(hasHeaders);
        }
      }
    });
    
    stream.on('error', reject);
    stream.on('end', () => {
      if (!hasReadFirstLine) {
        resolve(false); // Fichier vide ou pas de saut de ligne
      }
    });
  });
}

function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Supprimer tous les caractères non-numériques
  let cleaned = phone.replace(/[^0-9]/g, '');
  
  // Supprimer l'indicatif +33 ou 33 au début
  if (cleaned.startsWith('33') && cleaned.length > 10) {
    cleaned = '0' + cleaned.substring(2);
  }
  
  // Supprimer le 0 au début pour garder seulement le numéro sans indicatif
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

async function insertBlacklistBatch(phoneNumbers: string[], sourceFile: string): Promise<void> {
  for (const phoneNumber of phoneNumbers) {
    try {
      await db.exec`
        INSERT INTO mobile_blacklist (phone_number, source_file)
        VALUES (${phoneNumber}, ${sourceFile})
        ON CONFLICT (phone_number) DO NOTHING
      `;
    } catch (error) {
      console.error(`Error inserting blacklist number ${phoneNumber}:`, error);
    }
  }
}

async function updateBlacklistJobStatus(
  jobId: string,
  status: string,
  errorMessage?: string | null,
  startedAt?: Date | null,
  completedAt?: Date | null
): Promise<void> {
  await db.exec`
    UPDATE blacklist_jobs 
    SET status = ${status}, 
        error_message = ${errorMessage},
        started_at = ${startedAt || undefined},
        completed_at = ${completedAt || undefined}
    WHERE id = ${jobId}
  `;
}

async function updateBlacklistJobProgress(
  jobId: string,
  totalNumbers: number,
  processedNumbers: number,
  duplicateNumbers: number
): Promise<void> {
  await db.exec`
    UPDATE blacklist_jobs 
    SET total_numbers = ${totalNumbers},
        processed_numbers = ${processedNumbers},
        duplicate_numbers = ${duplicateNumbers}
    WHERE id = ${jobId}
  `;
}