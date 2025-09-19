import { api } from "encore.dev/api";
import { db } from "./db";
import type { ArchiveProcessingRequest, ArchiveProcessingResponse } from "./types";
import AdmZip from "adm-zip";
import csv from "csv-parser";
import { Readable } from "stream";
import { processArchiveInBackground } from "./background_processor";

export const uploadArchive = api<ArchiveProcessingRequest, ArchiveProcessingResponse>(
  { expose: true, method: "POST", path: "/archive/upload", bodyLimit: null },
  async ({ archiveBuffer, fileName, userId }) => {
    try {
      // Créer un nouveau job d'archive
      const archiveJob = await db.queryRow`
        INSERT INTO archive_jobs (user_id, archive_name, status)
        VALUES (${userId}, ${fileName}, 'processing')
        RETURNING id, archive_name, status, created_at
      `;

      if (!archiveJob) {
        throw new Error("Impossible de créer le job d'archive");
      }

      // Décoder le buffer Base64
      const zipBuffer = Buffer.from(archiveBuffer, 'base64');
      const zip = new AdmZip(zipBuffer);
      
      // Extraire et analyser les fichiers
      const entries = zip.getEntries();
      const fileTypes = categorizeFiles(entries.map(entry => entry.entryName));
      
      if (fileTypes.contactFiles.length === 0) {
        await db.exec`
          UPDATE archive_jobs 
          SET status = 'failed', error_message = 'Aucun fichier de contact trouvé dans l''archive'
          WHERE id = ${archiveJob.id}
        `;
        return {
          success: false,
          archiveJobId: archiveJob.id,
          message: "Aucun fichier de contact trouvé dans l'archive"
        };
      }

      // Traiter chaque fichier et stocker dans la table temporaire
      let totalRows = 0;
      for (const entry of entries) {
        if (entry.entryName.endsWith('.csv')) {
          const fileType = getFileType(entry.entryName, fileTypes);
          const csvContent = entry.getData().toString('utf8');
          const rowCount = await processFileToTempStorage(
            archiveJob.id, 
            entry.entryName, 
            fileType, 
            csvContent
          );
          totalRows += rowCount;
        }
      }

      // Lancer le traitement en arrière-plan
      processArchiveInBackground(archiveJob.id);

      return {
        success: true,
        archiveJobId: archiveJob.id,
        message: `Archive uploadée avec succès. ${totalRows} lignes en cours de traitement.`
      };

    } catch (error: any) {
      console.error("Erreur lors de l'upload d'archive:", error);
      return {
        success: false,
        archiveJobId: "",
        message: `Erreur: ${error.message}`
      };
    }
  }
);

function categorizeFiles(fileNames: string[]): {
  contactFiles: string[];
  blacklistFiles: string[];
  otherFiles: string[];
} {
  const contactFiles: string[] = [];
  const blacklistFiles: string[] = [];
  const otherFiles: string[] = [];

  for (const fileName of fileNames) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('blacklist_mobile')) {
      blacklistFiles.push(fileName);
    } else if (lowerName.endsWith('.csv')) {
      contactFiles.push(fileName);
    } else {
      otherFiles.push(fileName);
    }
  }

  return { contactFiles, blacklistFiles, otherFiles };
}

function getFileType(fileName: string, fileTypes: any): string {
  const lowerName = fileName.toLowerCase();
  
  if (fileTypes.blacklistFiles.includes(fileName)) {
    return 'blacklist';
  } else if (fileTypes.contactFiles.includes(fileName)) {
    return 'contact_data';
  } else {
    return 'other';
  }
}

async function processFileToTempStorage(
  archiveJobId: string,
  fileName: string,
  fileType: string,
  csvContent: string
): Promise<number> {
  const readable = Readable.from(csvContent);
  const parser = readable.pipe(csv());
  
  let rowCount = 0;
  const batchSize = 100;
  let batch: any[] = [];

  for await (const row of parser) {
    // Calculer le hexacle_hash pour les fichiers de contact
    let hexacleHash: string | null = null;
    if (fileType === 'contact_data') {
      hexacleHash = generateHexacleHash(row);
    }

    batch.push({
      archiveJobId,
      fileName,
      fileType,
      rowData: row,
      hexacleHash
    });

    if (batch.length >= batchSize) {
      await insertTempDataBatch(batch);
      rowCount += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertTempDataBatch(batch);
    rowCount += batch.length;
  }

  return rowCount;
}

async function insertTempDataBatch(batch: any[]): Promise<void> {
  for (const item of batch) {
    await db.exec`
      INSERT INTO temp_archive_data (
        archive_job_id, file_name, file_type, row_data, hexacle_hash
      )
      VALUES (
        ${item.archiveJobId}, ${item.fileName}, ${item.fileType}, 
        ${JSON.stringify(item.rowData)}, ${item.hexacleHash}
      )
    `;
  }
}

function generateHexacleHash(row: any): string {
  // Chercher les colonnes d'adresse dans différents formats possibles
  const addressFields = [
    'address', 'adresse', 'rue', 'street', 'addr',
    'numero_rue', 'num_rue', 'street_number'
  ];
  
  const cityFields = [
    'city', 'ville', 'localite', 'commune'
  ];
  
  const postalFields = [
    'postal_code', 'code_postal', 'cp', 'zip', 'zipcode'
  ];

  // Extraire les valeurs des champs d'adresse
  const address = findFieldValue(row, addressFields) || '';
  const city = findFieldValue(row, cityFields) || '';
  const postalCode = findFieldValue(row, postalFields) || '';

  // Concaténation: adresse + ville + code postal (normalisé)
  const components = [address, city, postalCode];
  
  return components
    .filter(component => component.toString().trim() !== '')
    .map(component => component.toString().trim().toUpperCase())
    .join('');
}

function findFieldValue(row: any, possibleFields: string[]): string | null {
  for (const field of possibleFields) {
    // Chercher en minuscules et majuscules
    if (row[field] !== undefined) return row[field];
    if (row[field.toLowerCase()] !== undefined) return row[field.toLowerCase()];
    if (row[field.toUpperCase()] !== undefined) return row[field.toUpperCase()];
  }
  return null;
}