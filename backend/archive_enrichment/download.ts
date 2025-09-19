import { api } from "encore.dev/api";
import { db } from "./db";
import AdmZip from "adm-zip";

export interface DownloadArchiveRequest {
  archiveJobId: string;
  userId: number;
}

export interface DownloadArchiveResponse {
  success: boolean;
  fileName: string;
  fileData: string; // Base64 encoded ZIP file
  message?: string;
}

export const downloadEnrichedArchive = api<DownloadArchiveRequest, DownloadArchiveResponse>(
  { expose: true, method: "GET", path: "/archive/download/:archiveJobId" },
  async ({ archiveJobId, userId }) => {
    try {
      // Vérifier que le job existe et appartient à l'utilisateur
      const job = await db.queryRow`
        SELECT id, user_id, archive_name, status, download_url
        FROM archive_jobs 
        WHERE id = ${archiveJobId} AND user_id = ${userId}
      `;

      if (!job) {
        return {
          success: false,
          fileName: "",
          fileData: "",
          message: "Archive non trouvée ou accès non autorisé"
        };
      }

      if (job.status !== 'completed') {
        return {
          success: false,
          fileName: "",
          fileData: "",
          message: `Archive pas encore prête. Statut: ${job.status}`
        };
      }

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

      if (processedData.length === 0) {
        return {
          success: false,
          fileName: "",
          fileData: "",
          message: "Aucune donnée trouvée pour cette archive"
        };
      }

      // Grouper par fichier
      const fileGroups = new Map<string, any[]>();
      for (const item of processedData) {
        if (!fileGroups.has(item.file_name)) {
          fileGroups.set(item.file_name, []);
        }
        
        // Utiliser les données enrichies si disponibles, sinon les données originales
        const finalData = item.enriched_data || item.row_data;
        
        // Filtrer les lignes blacklistées et nettoyer les métadonnées
        if (!finalData.is_blacklisted) {
          // Supprimer les métadonnées ajoutées pendant le traitement
          const cleanData = { ...finalData };
          delete cleanData.is_blacklisted;
          delete cleanData.blacklist_reason;
          delete cleanData.original_data;
          delete cleanData.id; // Supprimer l'ID de la base de données
          delete cleanData.hexacle_hash; // Optionnel: garder ou supprimer le hash
          
          fileGroups.get(item.file_name)?.push(cleanData);
        }
      }

      // Créer le ZIP final
      const zip = new AdmZip();
      let totalRowsInArchive = 0;

      for (const [fileName, rows] of fileGroups.entries()) {
        if (rows.length > 0) {
          const csvContent = generateCsvContent(rows);
          const enrichedFileName = fileName.replace('.csv', '_enriched.csv');
          zip.addFile(enrichedFileName, Buffer.from(csvContent, 'utf8'));
          totalRowsInArchive += rows.length;
        }
      }

      // Ajouter un fichier de résumé
      const summaryContent = generateSummaryReport(archiveJobId, fileGroups, processedData.length, totalRowsInArchive);
      zip.addFile('enrichment_summary.txt', Buffer.from(summaryContent, 'utf8'));

      const zipBuffer = zip.toBuffer();
      const base64Data = zipBuffer.toString('base64');

      return {
        success: true,
        fileName: `${job.archive_name}_enriched.zip`,
        fileData: base64Data,
        message: `Archive enrichie prête (${totalRowsInArchive} lignes finales)`
      };

    } catch (error: any) {
      console.error("Erreur lors du téléchargement:", error);
      return {
        success: false,
        fileName: "",
        fileData: "",
        message: `Erreur: ${error.message}`
      };
    }
  }
);

function generateCsvContent(rows: any[]): string {
  if (rows.length === 0) return '';

  // Extraire tous les champs possibles en excluant les métadonnées
  const allFields = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach(key => {
      allFields.add(key);
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

function generateSummaryReport(
  archiveJobId: string, 
  fileGroups: Map<string, any[]>, 
  originalTotal: number, 
  finalTotal: number
): string {
  const now = new Date().toISOString();
  
  let report = `RAPPORT D'ENRICHISSEMENT DE DONNÉES\n`;
  report += `=====================================\n\n`;
  report += `ID de traitement: ${archiveJobId}\n`;
  report += `Date de génération: ${now}\n\n`;
  
  report += `STATISTIQUES GLOBALES:\n`;
  report += `- Lignes originales: ${originalTotal}\n`;
  report += `- Lignes finales: ${finalTotal}\n`;
  report += `- Lignes supprimées (blacklist): ${originalTotal - finalTotal}\n\n`;
  
  report += `FICHIERS GÉNÉRÉS:\n`;
  for (const [fileName, rows] of fileGroups.entries()) {
    const enrichedFileName = fileName.replace('.csv', '_enriched.csv');
    report += `- ${enrichedFileName}: ${rows.length} lignes\n`;
  }
  
  report += `\nTRAITEMENT EFFECTUÉ:\n`;
  report += `1. Extraction des données des fichiers CSV de l'archive\n`;
  report += `2. Calcul du hash hexacle pour chaque ligne (adresse + ville + code postal)\n`;
  report += `3. Recherche de correspondances dans la base de données de contacts\n`;
  report += `4. Enrichissement automatique des données correspondantes\n`;
  report += `5. Application de la blacklist mobile\n`;
  report += `6. Génération de l'archive finale enrichie\n\n`;
  
  report += `NOTES:\n`;
  report += `- Les lignes présentes dans la blacklist mobile ont été supprimées\n`;
  report += `- Les données enrichies incluent toutes les informations disponibles dans la base\n`;
  report += `- La correspondance s'effectue sur la base de l'adresse normalisée\n`;
  
  return report;
}