import { db } from "./db";
import type { EnrichmentMatch, BlacklistEntry } from "./types";
import AdmZip from "adm-zip";

export async function processArchiveInBackground(archiveJobId: string): Promise<void> {
  try {
    console.log(`Démarrage du traitement en arrière-plan pour l'archive ${archiveJobId}`);
    
    // Marquer le job comme en cours d'enrichissement
    await db.exec`
      UPDATE archive_jobs 
      SET status = 'enriching' 
      WHERE id = ${archiveJobId}
    `;

    // Étape 1: Enrichissement basé sur hexacle_hash
    await performEnrichment(archiveJobId);

    // Étape 2: Application de la blacklist
    await applyBlacklist(archiveJobId);

    // Étape 3: Génération du fichier zip final
    const downloadUrl = await generateFinalArchive(archiveJobId);

    // Marquer le job comme terminé
    await db.exec`
      UPDATE archive_jobs 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, download_url = ${downloadUrl}
      WHERE id = ${archiveJobId}
    `;

    console.log(`Traitement terminé pour l'archive ${archiveJobId}`);

  } catch (error: any) {
    console.error(`Erreur lors du traitement de l'archive ${archiveJobId}:`, error);
    
    await db.exec`
      UPDATE archive_jobs 
      SET status = 'failed', error_message = ${error.message}
      WHERE id = ${archiveJobId}
    `;
  }
}

async function performEnrichment(archiveJobId: string): Promise<void> {
  console.log(`Démarrage de l'enrichissement pour ${archiveJobId}`);

  // Récupérer toutes les données de contact avec hexacle_hash non null
  const contactDataQuery = db.query`
    SELECT * FROM temp_archive_data 
    WHERE archive_job_id = ${archiveJobId} 
    AND file_type = 'contact_data' 
    AND hexacle_hash IS NOT NULL
  `;
  const contactData = [];
  for await (const row of contactDataQuery) {
    contactData.push(row);
  }

  console.log(`${contactData.length} lignes de contact à enrichir`);

  let enrichedCount = 0;
  const batchSize = 50;

  for (let i = 0; i < contactData.length; i += batchSize) {
    const batch = contactData.slice(i, i + batchSize);
    const hashes = batch.map(item => item.hexacle_hash).filter(Boolean);

    if (hashes.length === 0) continue;

    // Chercher les correspondances dans la table contacts
    const matchesQuery = db.query`
      SELECT * FROM contacts 
      WHERE hexacle_hash = ANY(${hashes})
    `;
    const matches = [];
    for await (const row of matchesQuery) {
      matches.push(row);
    }

    // Créer un index des correspondances par hash
    const matchIndex = new Map<string, any>();
    for (const match of matches) {
      if (match.hexacle_hash) {
        matchIndex.set(match.hexacle_hash, match);
      }
    }

    // Enrichir chaque élément du batch
    for (const item of batch) {
      if (item.hexacle_hash && matchIndex.has(item.hexacle_hash)) {
        const enrichmentData = matchIndex.get(item.hexacle_hash);
        
        // Combiner les données originales avec les données d'enrichissement
        const enrichedRowData = {
          ...item.row_data,
          ...enrichmentData,
          // Préserver certaines données originales importantes
          original_data: item.row_data
        };

        await db.exec`
          UPDATE temp_archive_data 
          SET is_enriched = TRUE, enriched_data = ${JSON.stringify(enrichedRowData)}
          WHERE id = ${item.id}
        `;

        enrichedCount++;
      }
    }

    console.log(`Enrichissement batch ${Math.floor(i/batchSize) + 1}: ${enrichedCount} lignes enrichies`);
  }

  console.log(`Enrichissement terminé: ${enrichedCount} lignes enrichies sur ${contactData.length}`);
}

async function applyBlacklist(archiveJobId: string): Promise<void> {
  console.log(`Application de la blacklist pour ${archiveJobId}`);

  // Récupérer les données de blacklist
  const blacklistDataQuery = db.query`
    SELECT row_data FROM temp_archive_data 
    WHERE archive_job_id = ${archiveJobId} 
    AND file_type = 'blacklist'
  `;
  const blacklistData = [];
  for await (const row of blacklistDataQuery) {
    blacklistData.push(row);
  }

  if (blacklistData.length === 0) {
    console.log("Aucune blacklist trouvée, pas de filtrage");
    return;
  }

  // Extraire tous les numéros de téléphone de la blacklist
  const blacklistedPhones = new Set<string>();
  for (const item of blacklistData) {
    const rowData = item.row_data;
    
    // Chercher les champs de téléphone mobile
    const mobileFields = ['mobile', 'mobile_phone', 'telephone', 'phone', 'tel', 'gsm'];
    for (const field of mobileFields) {
      const phoneValue = findFieldValue(rowData, [field]);
      if (phoneValue) {
        // Normaliser le numéro (supprimer espaces, tirets, etc.)
        const normalizedPhone = normalizePhoneNumber(phoneValue);
        if (normalizedPhone) {
          blacklistedPhones.add(normalizedPhone);
        }
      }
    }
  }

  console.log(`${blacklistedPhones.size} numéros dans la blacklist`);

  if (blacklistedPhones.size === 0) return;

  // Marquer les lignes blacklistées dans les données de contact
  const contactDataQuery = db.query`
    SELECT * FROM temp_archive_data 
    WHERE archive_job_id = ${archiveJobId} 
    AND file_type = 'contact_data'
  `;
  const contactData = [];
  for await (const row of contactDataQuery) {
    contactData.push(row);
  }

  let blacklistedCount = 0;

  for (const item of contactData) {
    const rowData = item.enriched_data || item.row_data;
    
    // Vérifier si le mobile de cette ligne est dans la blacklist
    const mobileFields = ['mobile', 'mobile_phone', 'telephone', 'phone', 'tel', 'gsm'];
    let isBlacklisted = false;

    for (const field of mobileFields) {
      const phoneValue = findFieldValue(rowData, [field]);
      if (phoneValue) {
        const normalizedPhone = normalizePhoneNumber(phoneValue);
        if (normalizedPhone && blacklistedPhones.has(normalizedPhone)) {
          isBlacklisted = true;
          break;
        }
      }
    }

    if (isBlacklisted) {
      // Marquer comme blacklisté en ajoutant un flag
      const updatedData = {
        ...rowData,
        is_blacklisted: true,
        blacklist_reason: 'Mobile phone found in blacklist'
      };

      await db.exec`
        UPDATE temp_archive_data 
        SET enriched_data = ${JSON.stringify(updatedData)}
        WHERE id = ${item.id}
      `;

      blacklistedCount++;
    }
  }

  console.log(`${blacklistedCount} lignes marquées comme blacklistées`);
}

async function generateFinalArchive(archiveJobId: string): Promise<string> {
  console.log(`Génération de l'archive finale pour ${archiveJobId}`);

  // Récupérer toutes les données traitées groupées par fichier
  const processedDataQuery = db.query`
    SELECT file_name, file_type, row_data, enriched_data, is_enriched
    FROM temp_archive_data 
    WHERE archive_job_id = ${archiveJobId} 
    AND file_type = 'contact_data'
    ORDER BY file_name
  `;
  const processedData = [];
  for await (const row of processedDataQuery) {
    processedData.push(row);
  }

  // Grouper par fichier
  const fileGroups = new Map<string, any[]>();
  for (const item of processedData) {
    if (!fileGroups.has(item.file_name)) {
      fileGroups.set(item.file_name, []);
    }
    
    // Utiliser les données enrichies si disponibles, sinon les données originales
    const finalData = item.enriched_data || item.row_data;
    
    // Filtrer les lignes blacklistées
    if (!finalData.is_blacklisted) {
      fileGroups.get(item.file_name)?.push(finalData);
    }
  }

  // Créer le ZIP final
  const zip = new AdmZip();

  for (const [fileName, rows] of fileGroups.entries()) {
    if (rows.length > 0) {
      const csvContent = generateCsvContent(rows);
      const enrichedFileName = fileName.replace('.csv', '_enriched.csv');
      zip.addFile(enrichedFileName, Buffer.from(csvContent, 'utf8'));
    }
  }

  // Sauvegarder le ZIP (pour l'instant, on génère juste une URL fictive)
  // Dans un vrai système, il faudrait stocker le fichier dans un service de stockage
  const zipBuffer = zip.toBuffer();
  const downloadUrl = `/download/archive/${archiveJobId}/enriched_data.zip`;
  
  // Stocker le ZIP buffer (ici on pourrait utiliser du stockage objet)
  // Pour l'instant, on simule avec l'URL
  
  console.log(`Archive finale générée: ${downloadUrl} (${zipBuffer.length} bytes)`);
  
  return downloadUrl;
}

function generateCsvContent(rows: any[]): string {
  if (rows.length === 0) return '';

  // Extraire tous les champs possibles
  const allFields = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach(key => {
      if (key !== 'is_blacklisted' && key !== 'blacklist_reason' && key !== 'original_data') {
        allFields.add(key);
      }
    });
  }

  const headers = Array.from(allFields).sort();
  
  // Générer le contenu CSV
  let csvContent = headers.join(',') + '\n';
  
  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      
      // Échapper les valeurs contenant des virgules ou des guillemets
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    
    csvContent += values.join(',') + '\n';
  }

  return csvContent;
}

function findFieldValue(row: any, possibleFields: string[]): string | null {
  for (const field of possibleFields) {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
      return String(row[field]);
    }
    
    const lowerField = field.toLowerCase();
    if (row[lowerField] !== undefined && row[lowerField] !== null && row[lowerField] !== '') {
      return String(row[lowerField]);
    }
    
    const upperField = field.toUpperCase();
    if (row[upperField] !== undefined && row[upperField] !== null && row[upperField] !== '') {
      return String(row[upperField]);
    }
  }
  return null;
}

function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  // Supprimer tous les caractères non numériques sauf le +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Si c'est trop court, probablement pas un numéro valide
  if (cleaned.length < 8) return null;
  
  return cleaned;
}