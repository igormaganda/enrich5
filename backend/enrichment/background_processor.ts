import { api } from "encore.dev/api";
import { enrichmentDB as db } from "./db";
import { ftp } from "~encore/clients";
import fs from "fs/promises";
import csv from "csv-parser";
import path from "path";
import { createReadStream } from "fs";

export const processFileInBackground = api<{ filePath: string; serverId?: string; fileName?: string }, { jobId: string }>(
  { expose: true, method: "POST", path: "/enrichment/process-file-background" },
  async ({ filePath, serverId, fileName }) => {
    // Créer un job de traitement d'enrichissement
    const jobResult = await ftp.createBackgroundJob({
      type: 'enrichment',
      data: {
        filePath,
        serverId,
        fileName,
        action: 'process_and_enrich'
      },
      estimatedDuration: 600 // 10 minutes estimées
    });

    // Démarrer le traitement en arrière-plan
    processEnrichmentFile(jobResult.id, filePath, serverId, fileName).catch(error => {
      console.error('Error in background enrichment process:', error);
      ftp.updateBackgroundJob({
        id: jobResult.id,
        status: 'failed',
        error: error.message
      });
    });

    return { jobId: jobResult.id };
  }
);

async function processEnrichmentFile(
  jobId: string, 
  filePath: string, 
  serverId?: string, 
  fileName?: string
): Promise<void> {
  await ftp.updateBackgroundJob({
    id: jobId,
    status: 'running',
    progress: 0,
    currentStep: 'Analyse du fichier'
  });

  try {
    // Étape 1: Analyser le fichier
    const fileStats = await fs.stat(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    await ftp.updateBackgroundJob({
      id: jobId,
      progress: 10,
      currentStep: `Fichier détecté: ${fileExtension} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`
    });

    let finalFilePath = filePath;
    
    // Étape 2: Décompresser si nécessaire
    if (['.zip', '.rar', '.gz'].includes(fileExtension)) {
      await ftp.updateBackgroundJob({
        id: jobId,
        progress: 20,
        currentStep: 'Décompression du fichier'
      });
      
      finalFilePath = await extractFile(filePath);
    }

    // Étape 3: Détecter la configuration de mapping
    await ftp.updateBackgroundJob({
      id: jobId,
      progress: 30,
      currentStep: 'Détection de la configuration de mapping'
    });

    const mappingConfig = await detectMappingConfiguration(finalFilePath);
    
    // Étape 4: Traiter le fichier CSV
    await ftp.updateBackgroundJob({
      id: jobId,
      progress: 40,
      currentStep: 'Lecture et traitement des données'
    });

    const processedRecords = await processCSVFile(finalFilePath, mappingConfig, jobId);

    // Étape 5: Enrichissement des données
    await ftp.updateBackgroundJob({
      id: jobId,
      progress: 70,
      currentStep: 'Enrichissement des données en cours'
    });

    await enrichProcessedData(processedRecords, jobId);

    // Étape 6: Nettoyage
    await ftp.updateBackgroundJob({
      id: jobId,
      progress: 90,
      currentStep: 'Nettoyage des fichiers temporaires'
    });

    await cleanupFiles(filePath, finalFilePath);

    // Étape 7: Finalisation
    await ftp.updateBackgroundJob({
      id: jobId,
      status: 'completed',
      progress: 100,
      currentStep: `Traitement terminé: ${processedRecords} enregistrements traités`
    });

    // Enregistrer dans l'historique
    await db.exec`
      INSERT INTO job_history (
        job_id, source_id, filename, status, file_type, 
        created_by, started_at, completed_at, records_processed
      )
      VALUES (
        ${jobId}, ${serverId || null}, ${fileName || path.basename(filePath)}, 
        'completed', 'ftp_auto', 'system', NOW(), NOW(), ${processedRecords}
      )
    `;

  } catch (error: any) {
    await ftp.updateBackgroundJob({
      id: jobId,
      status: 'failed',
      error: error.message
    });

    // Enregistrer l'erreur dans l'historique
    await db.exec`
      INSERT INTO job_history (
        job_id, source_id, filename, status, file_type, 
        created_by, started_at, completed_at, error_message
      )
      VALUES (
        ${jobId}, ${serverId || null}, ${fileName || path.basename(filePath)}, 
        'failed', 'ftp_auto', 'system', NOW(), NOW(), ${error.message}
      )
    `;

    throw error;
  }
}

async function extractFile(filePath: string): Promise<string> {
  // Simulation de décompression - à implémenter avec une vraie librairie
  const extractedPath = filePath.replace(/\.(zip|rar|gz)$/, '.csv');
  
  // Pour la simulation, on copie le fichier
  await fs.copyFile(filePath, extractedPath);
  
  return extractedPath;
}

async function detectMappingConfiguration(filePath: string): Promise<any> {
  // Détecter d'abord s'il y a des headers et le délimiteur
  const fileAnalysis = await analyzeFile(filePath);
  
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const parser = csv({ 
      separator: fileAnalysis.delimiter, 
      headers: fileAnalysis.hasHeaders
    });
    
    let headers: string[] = [];
    let firstRowProcessed = false;
    
    stream.pipe(parser)
      .on('headers', (detectedHeaders) => {
        headers = detectedHeaders;
      })
      .on('data', (row) => {
        if (!firstRowProcessed) {
          firstRowProcessed = true;
          
          let defaultMapping: Record<string, string> = {};
          
          if (fileAnalysis.hasHeaders) {
            // Avec headers - mapper selon les noms de colonnes
            headers.forEach(header => {
              const normalizedHeader = header.toLowerCase().trim();
              if (normalizedHeader.includes('hexacle') || normalizedHeader === 'hexacle') {
                defaultMapping['hexacle'] = header;
              } else if (normalizedHeader.includes('numero') || normalizedHeader === 'numero') {
                defaultMapping['numero'] = header;
              } else if (normalizedHeader.includes('voie') || normalizedHeader === 'voie') {
                defaultMapping['voie'] = header;
              } else if (normalizedHeader.includes('ville') || normalizedHeader === 'ville') {
                defaultMapping['ville'] = header;
              } else if (normalizedHeader.includes('cod_post') || normalizedHeader === 'cod_post') {
                defaultMapping['cod_post'] = header;
              } else if (normalizedHeader.includes('cod_insee') || normalizedHeader === 'cod_insee') {
                defaultMapping['cod_insee'] = header;
              }
            });
          } else {
            // Sans headers - utiliser l'ordre standard: HEXACLE;NUMERO;VOIE;VILLE;COD_POST;COD_INSEE
            const columnCount = Object.keys(row).length;
            if (columnCount >= 6) {
              defaultMapping = {
                'hexacle': '0',
                'numero': '1', 
                'voie': '2',
                'ville': '3',
                'cod_post': '4',
                'cod_insee': '5'
              };
            }
          }
          
          resolve({
            mapping: defaultMapping,
            delimiter: fileAnalysis.delimiter,
            hasHeaders: fileAnalysis.hasHeaders
          });
        }
      })
      .on('error', reject);
  });
}

async function processCSVFile(filePath: string, config: any, jobId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const parser = csv({
      separator: config.delimiter,
      headers: config.hasHeaders
    });
    
    let recordsProcessed = 0;
    let batch: any[] = [];
    const batchSize = 500; // Optimisé pour éviter les timeouts
    
    stream.pipe(parser)
      .on('data', async (row) => {
        try {
          const mappedRow: any = {};
          
          // Appliquer le mapping selon le format avec/sans headers
          for (const [destCol, sourceCol] of Object.entries(config.mapping)) {
            let value = '';
            
            if (config.hasHeaders) {
              value = row[sourceCol as string] || '';
            } else {
              // Sans headers, sourceCol est l'index de la colonne
              const columnIndex = parseInt(sourceCol as string);
              const values = Object.values(row);
              value = (values[columnIndex] as string) || '';
            }
            
            if (value && value.trim() !== '') {
              mappedRow[destCol.toLowerCase()] = value.trim();
            }
          }
          
          // Vérifier que nous avons au moins HEXACLE pour traiter la ligne
          if (mappedRow.hexacle) {
            batch.push(mappedRow);
          }
          
          if (batch.length >= batchSize) {
            await processBatch(batch);
            recordsProcessed += batch.length;
            batch = [];
            
            // Mettre à jour le progrès
            await ftp.updateBackgroundJob({
              id: jobId,
              progress: Math.min(40 + (recordsProcessed / 1000) * 20, 60),
              currentStep: `${recordsProcessed} enregistrements traités`
            });
          }
        } catch (error) {
          console.error('Error processing row:', error);
        }
      })
      .on('end', async () => {
        try {
          if (batch.length > 0) {
            await processBatch(batch);
            recordsProcessed += batch.length;
          }
          resolve(recordsProcessed);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function analyzeFile(filePath: string): Promise<{ hasHeaders: boolean; delimiter: string }> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    let firstLine = '';
    let hasReadFirstLine = false;
    
    stream.on('data', (chunk) => {
      if (!hasReadFirstLine) {
        firstLine += chunk.toString();
        const lineEnd = firstLine.indexOf('\n');
        if (lineEnd !== -1) {
          firstLine = firstLine.substring(0, lineEnd).trim();
          hasReadFirstLine = true;
          stream.destroy();
          
          // Détecter le délimiteur (; ou ,)
          const semicolonCount = (firstLine.match(/;/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          const delimiter = semicolonCount > commaCount ? ';' : ',';
          
          // Détecter les headers
          const firstLineUpper = firstLine.toUpperCase();
          const hasHeaders = firstLineUpper.includes('HEXACLE') && 
                           firstLineUpper.includes('NUMERO') && 
                           firstLineUpper.includes('VILLE');
          
          resolve({ hasHeaders, delimiter });
        }
      }
    });
    
    stream.on('error', reject);
    stream.on('end', () => {
      if (!hasReadFirstLine) {
        resolve({ hasHeaders: false, delimiter: ';' }); // Par défaut
      }
    });
  });
}

async function processBatch(batch: any[]): Promise<void> {
  if (batch.length === 0) return;
  
  try {
    // Traiter chaque élément du lot individuellement pour plus de stabilité
    for (const row of batch) {
      await db.exec`
        INSERT INTO imported_data (hexacle, numero, voie, ville, cod_post, cod_insee)
        VALUES (${row.hexacle || null}, ${row.numero || null}, ${row.voie || null}, 
                ${row.ville || null}, ${row.cod_post || null}, ${row.cod_insee || null})
        ON CONFLICT (hexacle) DO UPDATE SET
          numero = EXCLUDED.numero,
          voie = EXCLUDED.voie,
          ville = EXCLUDED.ville,
          cod_post = EXCLUDED.cod_post,
          cod_insee = EXCLUDED.cod_insee
      `;
    }
    
    console.log(`Processed batch of ${batch.length} records`);
  } catch (error) {
    console.error('Error processing batch, trying individual inserts:', error);
    
    // En cas d'erreur sur le lot, essayer individuellement
    for (const row of batch) {
      try {
        await db.exec`
          INSERT INTO imported_data (hexacle, numero, voie, ville, cod_post, cod_insee)
          VALUES (${row.hexacle || null}, ${row.numero || null}, ${row.voie || null}, 
                  ${row.ville || null}, ${row.cod_post || null}, ${row.cod_insee || null})
          ON CONFLICT (hexacle) DO UPDATE SET
            numero = EXCLUDED.numero,
            voie = EXCLUDED.voie,
            ville = EXCLUDED.ville,
            cod_post = EXCLUDED.cod_post,
            cod_insee = EXCLUDED.cod_insee
        `;
      } catch (individualError) {
        console.error('Error inserting individual row:', individualError);
      }
    }
  }
}

async function enrichProcessedData(recordCount: number, jobId: string): Promise<void> {
  // Simulation de l'enrichissement des données
  const steps = Math.ceil(recordCount / 100);
  
  for (let i = 0; i < steps; i++) {
    // Simuler le traitement
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const progress = 70 + Math.floor((i / steps) * 20);
    await ftp.updateBackgroundJob({
      id: jobId,
      progress,
      currentStep: `Enrichissement: ${i * 100}/${recordCount} enregistrements`
    });
  }
}

async function cleanupFiles(originalPath: string, extractedPath?: string): Promise<void> {
  try {
    // Supprimer le fichier original
    await fs.unlink(originalPath);
    
    // Supprimer le fichier extrait s'il est différent
    if (extractedPath && extractedPath !== originalPath) {
      await fs.unlink(extractedPath);
    }
  } catch (error) {
    console.error('Error cleaning up files:', error);
  }
}