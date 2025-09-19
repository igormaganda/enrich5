import { api } from "encore.dev/api";
import fs from "fs/promises";
import path from "path";

export interface DownloadEnrichmentResultRequest {
  jobId: string;
  fileName: string;
}

export const downloadEnrichmentResult = api<DownloadEnrichmentResultRequest, { success: boolean; data?: string; error?: string }>(
  { expose: true, method: "GET", path: "/download/enrichment_results/:jobId/:fileName" },
  async ({ jobId, fileName }) => {
    try {
      const filePath = path.join('/tmp', 'enrichment_results', jobId, fileName);
      
      // Vérifier que le fichier existe
      await fs.access(filePath);
      
      // Lire le fichier en base64 pour le retour
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      return {
        success: true,
        data: base64Data
      };
      
    } catch (error: any) {
      console.error(`Error downloading enrichment result ${jobId}/${fileName}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
);