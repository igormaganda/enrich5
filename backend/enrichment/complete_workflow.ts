import { api } from "encore.dev/api";
import { enrichmentDB as db } from "./db";
import { notification } from "~encore/clients";
import fs from "fs/promises";
import csv from "csv-parser";
import path from "path";
import { createReadStream, createWriteStream } from "fs";
import { v4 as uuidv4 } from "uuid";
import AdmZip from "adm-zip";

export interface StartCompleteEnrichmentRequest {
  filePath: string;
  fileName: string;
  serverId?: string;
}

export interface CompleteEnrichmentResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export const startCompleteEnrichment = api<StartCompleteEnrichmentRequest, CompleteEnrichmentResponse>(
  { expose: true, method: "POST", path: "/enrichment/start-complete-workflow" },
  async ({ filePath, fileName, serverId }) => {
    const jobId = uuidv4();
    
    try {
      // Créer l'entrée de job
      await db.exec`
        INSERT INTO enrichment_jobs (id, status, file_name, file_path, server_id)
        VALUES (${jobId}, 'pending', ${fileName}, ${filePath}, ${serverId})
      `;
      
      // Démarrer le processus en arrière-plan
      processCompleteEnrichmentWorkflow(jobId, filePath, fileName, serverId).catch(async (error) => {
        console.error(`Enrichment job ${jobId} failed:`, error);
        await updateJobStatus(jobId, 'failed', error.message);
        await sendErrorNotification(jobId, fileName, error.message);
      });
      
      return {
        success: true,
        jobId,
        message: `Enrichment workflow started for ${fileName}`
      };
      
    } catch (error: any) {
      console.error('Failed to start enrichment workflow:', error);
      return {
        success: false,
        jobId,
        message: `Failed to start enrichment: ${error.message}`
      };
    }
  }
);

async function processCompleteEnrichmentWorkflow(
  jobId: string,
  filePath: string,
  fileName: string,
  serverId?: string
): Promise<void> {
  
  await updateJobStatus(jobId, 'processing', null, new Date());
  
  try {
    console.log(`Starting complete enrichment workflow for job ${jobId}`);
    
    // Étape 1: Scan et récupération du fichier
    console.log(`Step 1: File scan and retrieval for ${fileName}`);
    const processedFilePath = await scanAndRetrieveFile(filePath, fileName);
    
    // Étape 2: Désarchiver si c'est une archive et séparer les fichiers blacklist
    console.log(`Step 2: Extract archive and separate blacklist files`);
    const { referenceFiles, blacklistFiles } = await extractAndSeparateFiles(processedFilePath, fileName);
    
    // Traiter les fichiers blacklist séparément
    if (blacklistFiles.length > 0) {
      console.log(`Processing ${blacklistFiles.length} blacklist files`);
      for (const blacklistFile of blacklistFiles) {
        await processBlacklistFile(blacklistFile);
      }
    }
    
    // Étape 3: Insertion en base temporaire (tables distinctes par fichier)
    console.log(`Step 3: Insert into temporary tables`);
    const totalRecords = await insertIntoTempTables(jobId, referenceFiles);
    await updateJobRecord(jobId, { total_records: totalRecords });
    
    // Étape 4: Formation des temp_hexacle_hash
    console.log(`Step 4: Generate temp_hexacle_hash`);
    await generateTempHexacleHashes(jobId);
    
    // Étape 5: Recherche et enrichissement
    console.log(`Step 5: Search and enrichment`);
    const enrichmentStats = await performEnrichment(jobId);
    await updateJobRecord(jobId, {
      processed_records: enrichmentStats.processed,
      matched_records: enrichmentStats.matched,
      enriched_records: enrichmentStats.enriched
    });
    
    // Étape 6: Filtrage blacklist
    console.log(`Step 6: Blacklist filtering`);
    const filteredStats = await applyBlacklistFiltering(jobId);
    await updateJobRecord(jobId, {
      filtered_records: filteredStats.filtered,
      final_records: filteredStats.final
    });
    
    // Étape 7: Génération du résultat final en ZIP
    console.log(`Step 7: Generate final result ZIP`);
    const resultInfo = await generateFinalResultZip(jobId, fileName);
    await updateJobRecord(jobId, {
      result_file_path: resultInfo.filePath,
      result_download_url: resultInfo.downloadUrl
    });
    
    // Étape 8: Finalisation et notification
    console.log(`Step 8: Finalization and notification`);
    await updateJobStatus(jobId, 'completed', null, null, new Date());
    await sendSuccessNotification(jobId, fileName, resultInfo);
    
    console.log(`Complete enrichment workflow finished successfully for job ${jobId}`);
    
  } catch (error: any) {
    console.error(`Error in complete enrichment workflow for job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed', error.message, null, new Date());
    await sendErrorNotification(jobId, fileName, error.message);
    throw error;
  }
}

async function scanAndRetrieveFile(filePath: string, fileName: string): Promise<string> {
  // Vérifier que le fichier existe et est accessible
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error(`File not found or not accessible: ${filePath}`);
  }
  
  console.log(`File retrieved: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  return filePath;
}

async function extractAndSeparateFiles(filePath: string, fileName: string): Promise<{ referenceFiles: string[], blacklistFiles: string[] }> {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.zip') {
    console.log(`Extracting ZIP archive: ${fileName}`);
    
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const extractedDir = path.join(path.dirname(filePath), `${path.basename(fileName, '.zip')}_extracted`);
    
    // Créer le répertoire d'extraction
    await fs.mkdir(extractedDir, { recursive: true });
    
    const referenceFiles: string[] = [];
    const blacklistFiles: string[] = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.csv')) {
        const extractedPath = path.join(extractedDir, entry.entryName);
        await fs.writeFile(extractedPath, entry.getData());
        
        // Séparer les fichiers blacklist des fichiers de référence
        if (entry.entryName.toLowerCase().startsWith('blacklist_mobile')) {
          blacklistFiles.push(extractedPath);
          console.log(`Extracted blacklist file: ${entry.entryName}`);
        } else {
          referenceFiles.push(extractedPath);
          console.log(`Extracted reference file: ${entry.entryName}`);
        }
      }
    }
    
    if (referenceFiles.length === 0 && blacklistFiles.length === 0) {
      throw new Error('No CSV files found in the archive');
    }
    
    return { referenceFiles, blacklistFiles };
  }
  
  // Si ce n'est pas une archive, déterminer le type de fichier
  if (fileName.toLowerCase().startsWith('blacklist_mobile')) {
    return { referenceFiles: [], blacklistFiles: [filePath] };
  } else {
    return { referenceFiles: [filePath], blacklistFiles: [] };
  }
}

async function processBlacklistFile(filePath: string): Promise<void> {
  // Utiliser le service blacklist_mobile pour traiter le fichier
  const fileName = path.basename(filePath);
  console.log(`Processing blacklist file: ${fileName}`);
  
  try {
    // Import du service blacklist_mobile
    const { processBlacklistFile } = await import('./blacklist_mobile');
    await processBlacklistFile({ filePath, fileName });
    console.log(`Blacklist file ${fileName} processed successfully`);
  } catch (error) {
    console.error(`Error processing blacklist file ${fileName}:`, error);
  }
}

async function extractArchiveIfNeeded(filePath: string, fileName: string): Promise<string[]> {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.zip') {
    console.log(`Extracting ZIP archive: ${fileName}`);
    
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const extractedDir = path.join(path.dirname(filePath), `${path.basename(fileName, '.zip')}_extracted`);
    
    // Créer le répertoire d'extraction
    await fs.mkdir(extractedDir, { recursive: true });
    
    const extractedFiles: string[] = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.csv')) {
        const extractedPath = path.join(extractedDir, entry.entryName);
        await fs.writeFile(extractedPath, entry.getData());
        extractedFiles.push(extractedPath);
        console.log(`Extracted: ${entry.entryName}`);
      }
    }
    
    if (extractedFiles.length === 0) {
      throw new Error('No CSV files found in the archive');
    }
    
    return extractedFiles;
  }
  
  // Si ce n'est pas une archive, retourner le fichier original
  return [filePath];
}

async function insertIntoTempTables(jobId: string, filePaths: string[]): Promise<number> {
  let totalRecords = 0;
  
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    console.log(`Processing file for temp insertion: ${fileName}`);
    
    // Détecter si c'est un fichier blacklist
    if (fileName.toLowerCase().startsWith('blacklist_mobile')) {
      console.log(`Detected blacklist file: ${fileName}, skipping temp insertion`);
      // Les fichiers blacklist sont traités séparément
      continue;
    }
    
    // Détecter s'il y a des headers
    const hasHeaders = await detectCSVHeaders(filePath);
    console.log(`File ${fileName} has headers: ${hasHeaders}`);
    
    const recordCount = await new Promise<number>((resolve, reject) => {
      const stream = createReadStream(filePath);
      const parser = csv({ 
        separator: ';',
        headers: hasHeaders
      });
      
      let count = 0;
      let batch: any[] = [];
      const batchSize = 100;
      
      stream.pipe(parser)
        .on('data', async (row) => {
          try {
            // Structure fixe: HEXACLE;NUMERO;VOIE;VILLE;COD_POST;COD_INSEE
            let hexacle, numero, voie, ville, cod_post, cod_insee;
            
            if (hasHeaders) {
              // Avec headers, mapper selon les noms
              hexacle = row.HEXACLE || row.hexacle || '';
              numero = row.NUMERO || row.numero || '';
              voie = row.VOIE || row.voie || '';
              ville = row.VILLE || row.ville || '';
              cod_post = row.COD_POST || row.cod_post || '';
              cod_insee = row.COD_INSEE || row.cod_insee || '';
            } else {
              // Sans headers, utiliser l'ordre fixe
              const values = Object.values(row);
              hexacle = values[0] || '';
              numero = values[1] || '';
              voie = values[2] || '';
              ville = values[3] || '';
              cod_post = values[4] || '';
              cod_insee = values[5] || '';
            }
            
            // Préparer les données pour l'insertion temporaire
            const tempData = {
              job_id: jobId,
              file_name: fileName,
              hexacle_original: cleanString(hexacle),
              numero: cleanString(numero),
              voie: cleanString(voie),
              ville: cleanString(ville),
              cod_post: cleanString(cod_post),
              cod_insee: cleanString(cod_insee),
              raw_data: JSON.stringify({
                hexacle, numero, voie, ville, cod_post, cod_insee
              })
            };
            
            batch.push(tempData);
            
            if (batch.length >= batchSize) {
              await insertTempBatch(batch);
              count += batch.length;
              batch = [];
            }
          } catch (error) {
            console.error('Error processing row:', error);
          }
        })
        .on('end', async () => {
          try {
            if (batch.length > 0) {
              await insertTempBatch(batch);
              count += batch.length;
            }
            resolve(count);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
    
    totalRecords += recordCount;
    console.log(`Inserted ${recordCount} records from ${fileName}`);
  }
  
  return totalRecords;
}

async function detectCSVHeaders(filePath: string): Promise<boolean> {
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
          const firstLineClean = firstLine.trim().toUpperCase();
          const hasHeaders = firstLineClean.includes('HEXACLE') ||
                           firstLineClean.includes('NUMERO') ||
                           firstLineClean.includes('VOIE') ||
                           firstLineClean.includes('VILLE');
          
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

async function insertTempBatch(batch: any[]): Promise<void> {
  for (const record of batch) {
    try {
      const { tempHexacleHash, tempsHexacleHash } = computeTempHashes(record);

      await db.exec`
        INSERT INTO temp_reference_data (
          job_id, file_name, temp_hexacle_hash, temps_hexacle_hash, hexacle_original, numero, voie, ville, cod_post, cod_insee, raw_data
        )
        VALUES (
          ${record.job_id}, ${record.file_name}, ${tempHexacleHash}, ${tempsHexacleHash}, ${record.hexacle_original},
          ${record.numero}, ${record.voie}, ${record.ville}, ${record.cod_post}, ${record.cod_insee}, ${record.raw_data}::jsonb
        )
      `;
    } catch (error) {
      console.error('Error inserting temp record:', error);
    }
  }
}

function computeTempHashes(record: any): { tempHexacleHash: string; tempsHexacleHash: string } {
  const components = [
    record.numero ?? '',
    record.voie ?? '',
    record.ville ?? '',
    record.cod_post ?? ''
  ].map(value => String(value ?? ''));

  const combined = components.join('');
  const tempHexacleHash = sanitizeHexacleHash(combined);

  const timestamp = new Date().toISOString();
  const tempsHexacleHash = sanitizeHexacleHash(`${timestamp}${combined}`);

  return {
    tempHexacleHash,
    tempsHexacleHash
  };
}

function sanitizeHexacleHash(value: string): string {
  if (!value) {
    return '';
  }

  const normalized = value
    .toString()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[-.:]/g, '')
    .toUpperCase();

  return normalized.substring(0, 255);
}

async function generateTempHexacleHashes(jobId: string): Promise<void> {
  console.log(`Generating temp_hexacle_hash for job ${jobId}`);

  // Formation correcte du hexacle_hash: numero + voie + ville + cod_post
  await db.exec`
    UPDATE temp_reference_data 
    SET temp_hexacle_hash = COALESCE(numero, '') || COALESCE(voie, '') || COALESCE(ville, '') || COALESCE(cod_post, '')
    WHERE job_id = ${jobId} AND temp_hexacle_hash = ''
  `;

  // Nettoyer et normaliser les hexacle_hash (supprimer espaces, tirets, mettre en majuscules)
  await db.exec`
    UPDATE temp_reference_data
    SET temp_hexacle_hash = UPPER(TRIM(REPLACE(REPLACE(REPLACE(temp_hexacle_hash, ' ', ''), '-', ''), '.', '')))
    WHERE job_id = ${jobId}
  `;

  await db.exec`
    UPDATE temp_reference_data
    SET temps_hexacle_hash = UPPER(TRIM(REPLACE(REPLACE(REPLACE(temps_hexacle_hash, ' ', ''), '-', ''), '.', '')))
    WHERE job_id = ${jobId}
  `;

  console.log(`Temp hexacle hashes generated for job ${jobId}`);
}

async function performEnrichment(jobId: string): Promise<{ processed: number, matched: number, enriched: number }> {
  console.log(`Performing enrichment for job ${jobId}`);
  
  // Récupérer tous les enregistrements temporaires
  const tempRecordsResult = await db.query`
    SELECT id, temp_hexacle_hash, temps_hexacle_hash, raw_data
    FROM temp_reference_data
    WHERE job_id = ${jobId} AND temp_hexacle_hash != ''
  `;
  
  const tempRecords: any[] = [];
  for await (const record of tempRecordsResult) {
    tempRecords.push(record);
  }
  
  let processed = 0;
  let matched = 0;
  let enriched = 0;
  
  for (const tempRecord of tempRecords) {
    try {
      // Rechercher une correspondance dans la table contacts
      const contactMatch = await db.queryRow`
        SELECT * FROM contacts 
        WHERE hexacle_hash = ${tempRecord.temp_hexacle_hash}
        LIMIT 1
      `;
      
      const foundMatch = !!contactMatch;
      
      // Insérer le résultat d'enrichissement
      await db.exec`
        INSERT INTO enrichment_results (
          job_id, temp_hexacle_hash, temps_hexacle_hash, found_match, enriched_data, reference_data
        )
        VALUES (
          ${jobId}, ${tempRecord.temp_hexacle_hash}, ${tempRecord.temps_hexacle_hash}, ${foundMatch},
          ${contactMatch ? JSON.stringify(contactMatch) : null}::jsonb,
          ${tempRecord.raw_data}::jsonb
        )
      `;
      
      processed++;
      if (foundMatch) {
        matched++;
        enriched++;
      }
      
    } catch (error) {
      console.error(`Error enriching record ${tempRecord.id}:`, error);
    }
  }
  
  console.log(`Enrichment completed: ${processed} processed, ${matched} matched, ${enriched} enriched`);
  return { processed, matched, enriched };
}

async function applyBlacklistFiltering(jobId: string): Promise<{ filtered: number, final: number }> {
  console.log(`Applying mobile blacklist filtering for job ${jobId}`);
  
  let filtered = 0;
  let final = 0;
  
  // Compter les enregistrements avant filtrage
  const beforeFilter = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM enrichment_results WHERE job_id = ${jobId}
  `;
  
  // Filtrer les numéros qui sont dans la blacklist
  // On vérifie mobile_phone et landline_phone des données enrichies
  await db.exec`
    DELETE FROM enrichment_results 
    WHERE job_id = ${jobId} 
    AND found_match = true 
    AND (
      -- Vérifier mobile_phone (sans le 0 initial)
      SUBSTRING(enriched_data->>'mobile_phone' FROM 2) IN (
        SELECT phone_number FROM mobile_blacklist
      )
      OR
      -- Vérifier landline_phone (sans le 0 initial)  
      SUBSTRING(enriched_data->>'landline_phone' FROM 2) IN (
        SELECT phone_number FROM mobile_blacklist
      )
      OR
      -- Vérifier mobile_phone avec le 0
      enriched_data->>'mobile_phone' IN (
        SELECT '0' || phone_number FROM mobile_blacklist
      )
      OR
      -- Vérifier landline_phone avec le 0
      enriched_data->>'landline_phone' IN (
        SELECT '0' || phone_number FROM mobile_blacklist
      )
    )
  `;
  
  // Compter les enregistrements après filtrage
  const afterFilter = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM enrichment_results WHERE job_id = ${jobId}
  `;
  
  filtered = (beforeFilter?.count || 0) - (afterFilter?.count || 0);
  final = afterFilter?.count || 0;
  
  console.log(`Mobile blacklist filtering completed: ${filtered} filtered out, ${final} final records`);
  return { filtered, final };
}

async function generateFinalResultZip(jobId: string, originalFileName: string): Promise<{ filePath: string, downloadUrl: string }> {
  console.log(`Generating final result ZIP for job ${jobId}`);
  
  const resultsDir = path.join('/tmp', 'enrichment_results', jobId);
  await fs.mkdir(resultsDir, { recursive: true });
  
  // Générer le fichier CSV des résultats
  const csvFilePath = path.join(resultsDir, `enriched_${originalFileName.replace('.zip', '.csv')}`);
  const writeStream = createWriteStream(csvFilePath);
  
  // Écrire l'en-tête CSV
  const headers = [
    'temp_hexacle_hash', 'temps_hexacle_hash', 'found_match', 'original_hexacle', 'original_numero', 'original_voie',
    'original_ville', 'original_cod_post', 'original_cod_insee',
    'enriched_first_name', 'enriched_last_name', 'enriched_email', 'enriched_mobile_phone',
    'enriched_landline_phone', 'enriched_address', 'enriched_city', 'enriched_postal_code'
  ];
  writeStream.write(headers.join(',') + '\\n');

  // Récupérer et écrire les résultats
  const resultsQuery = await db.query`
    SELECT temp_hexacle_hash, temps_hexacle_hash, found_match, enriched_data, reference_data
    FROM enrichment_results
    WHERE job_id = ${jobId}
    ORDER BY temp_hexacle_hash
  `;
  
  const results: any[] = [];
  for await (const result of resultsQuery) {
    results.push(result);
  }
  
  for (const result of results) {
    const refData = JSON.parse(result.reference_data);
    const enrichedData = result.found_match ? JSON.parse(result.enriched_data) : {};
    
    const row = [
      result.temp_hexacle_hash,
      result.temps_hexacle_hash,
      result.found_match,
      refData.hexacle || '',
      refData.numero || '',
      refData.voie || '',
      refData.ville || '',
      refData.cod_post || '',
      refData.cod_insee || '',
      enrichedData.first_name || '',
      enrichedData.last_name || '',
      enrichedData.email || '',
      enrichedData.mobile_phone || '',
      enrichedData.landline_phone || '',
      enrichedData.address || '',
      enrichedData.city || '',
      enrichedData.postal_code || ''
    ];
    
    writeStream.write(row.map(field => `"${field}"`).join(',') + '\\n');
  }
  
  writeStream.end();
  
  // Créer le ZIP
  const zipFilePath = path.join(resultsDir, `enriched_${originalFileName}`);
  const zip = new AdmZip();
  zip.addLocalFile(csvFilePath);
  zip.writeZip(zipFilePath);
  
  // Générer l'URL de téléchargement (à adapter selon votre système)
  const downloadUrl = `/download/enrichment_results/${jobId}/enriched_${originalFileName}`;
  
  console.log(`Final result ZIP generated: ${zipFilePath}`);
  return { filePath: zipFilePath, downloadUrl };
}

// Fonctions utilitaires
function cleanString(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value).trim().substring(0, 255);
}

function parseAge(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = parseInt(String(value), 10);
  return (isNaN(num) || num < 0 || num > 120) ? null : num;
}

async function updateJobStatus(
  jobId: string, 
  status: string, 
  errorMessage?: string | null,
  startedAt?: Date | null,
  completedAt?: Date | null
): Promise<void> {
  await db.exec`
    UPDATE enrichment_jobs 
    SET status = ${status}, 
        error_message = ${errorMessage},
        started_at = ${startedAt || undefined},
        completed_at = ${completedAt || undefined}
    WHERE id = ${jobId}
  `;
}

async function updateJobRecord(jobId: string, updates: Record<string, any>): Promise<void> {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  
  for (const [key, value] of entries) {
    if (key === 'total_records') {
      await db.exec`UPDATE enrichment_jobs SET total_records = ${value} WHERE id = ${jobId}`;
    } else if (key === 'processed_records') {
      await db.exec`UPDATE enrichment_jobs SET processed_records = ${value} WHERE id = ${jobId}`;
    } else if (key === 'matched_records') {
      await db.exec`UPDATE enrichment_jobs SET matched_records = ${value} WHERE id = ${jobId}`;
    } else if (key === 'enriched_records') {
      await db.exec`UPDATE enrichment_jobs SET enriched_records = ${value} WHERE id = ${jobId}`;
    } else if (key === 'filtered_records') {
      await db.exec`UPDATE enrichment_jobs SET filtered_records = ${value} WHERE id = ${jobId}`;
    } else if (key === 'final_records') {
      await db.exec`UPDATE enrichment_jobs SET final_records = ${value} WHERE id = ${jobId}`;
    } else if (key === 'result_file_path') {
      await db.exec`UPDATE enrichment_jobs SET result_file_path = ${value} WHERE id = ${jobId}`;
    } else if (key === 'result_download_url') {
      await db.exec`UPDATE enrichment_jobs SET result_download_url = ${value} WHERE id = ${jobId}`;
    } else if (key === 'error_message') {
      await db.exec`UPDATE enrichment_jobs SET error_message = ${value} WHERE id = ${jobId}`;
    } else if (key === 'email_sent') {
      await db.exec`UPDATE enrichment_jobs SET email_sent = ${value} WHERE id = ${jobId}`;
    }
  }
}

async function sendSuccessNotification(jobId: string, fileName: string, resultInfo: any): Promise<void> {
  try {
    await notification.sendSimpleEmail({
      to: 'admin@example.com', // À configurer
      subject: `Enrichment Completed: ${fileName}`,
      message: `
        Enrichment job ${jobId} completed successfully for file ${fileName}.
        
        Download your results here: ${resultInfo.downloadUrl}
        
        Processing completed at: ${new Date().toISOString()}
      `
    });
  } catch (error) {
    console.error('Failed to send success notification:', error);
  }
}

async function sendErrorNotification(jobId: string, fileName: string, errorMessage: string): Promise<void> {
  try {
    await notification.sendSimpleEmail({
      to: 'admin@example.com', // À configurer
      subject: `Enrichment Failed: ${fileName}`,
      message: `
        Enrichment job ${jobId} failed for file ${fileName}.
        
        Error: ${errorMessage}
        
        Failed at: ${new Date().toISOString()}
      `
    });
  } catch (error) {
    console.error('Failed to send error notification:', error);
  }
}