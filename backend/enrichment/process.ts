import { api, APIError } from "encore.dev/api";
import type { StartImportRequest, StartImportResponse } from "./types";
import type { EnrichmentSource } from "../settings/types";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import csv from "csv-parser";
import { enrichmentDB as db } from "./db";

export const startImport = api<StartImportRequest, StartImportResponse>(
  { expose: true, method: "POST", path: "/enrichment/start-import" },
  async ({ sourceId }) => {
    const jobId = uuidv4();
    let recordsProcessed = 0;

    try {
      const source = await db.queryRow<EnrichmentSource & { mapping: string }>`
        SELECT id, name, file_path as "filePath", has_headers as "hasHeaders", delimiter, mapping
        FROM enrichment_sources
        WHERE id = ${sourceId}
      `;

      if (!source) {
        throw new Error("Source not found");
      }

      await db.exec`
        INSERT INTO job_history (job_id, source_id, filename, status, file_type, created_by, started_at)
        VALUES (${jobId}, ${sourceId}, ${source.name}, 'processing', 'enrichment_import', 'system', NOW())
      `;

      const mapping = JSON.parse(source.mapping) as Record<string, string>;
      const reversedMapping = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [value, key]));

      const stream = fs.createReadStream(source.filePath).pipe(csv({
        separator: source.delimiter,
        headers: source.hasHeaders,
        mapHeaders: ({ header }) => header.trim(),
      }));

      const batchSize = 100;
      let batch: any[] = [];

      for await (const row of stream) {
        const importedRow: any = { source_id: sourceId };
        for (const destCol in reversedMapping) {
          const sourceCol = reversedMapping[destCol];
          if (row[sourceCol]) {
            importedRow[destCol.toLowerCase()] = row[sourceCol];
          }
        }
        batch.push(importedRow);

        if (batch.length >= batchSize) {
          await insertBatch(batch);
          recordsProcessed += batch.length;
          await db.exec`UPDATE job_history SET records_processed = ${recordsProcessed} WHERE job_id = ${jobId}`;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await insertBatch(batch);
        recordsProcessed += batch.length;
      }

      await db.exec`
        UPDATE job_history 
        SET status = 'completed', records_processed = ${recordsProcessed}, completed_at = NOW()
        WHERE job_id = ${jobId}
      `;

      return { success: true, jobId, recordsProcessed };

    } catch (error: any) {
      await db.exec`
        UPDATE job_history
        SET status = 'failed', error_message = ${error.message}, completed_at = NOW()
        WHERE job_id = ${jobId}
      `;
      throw APIError.internal("Failed to import data", error as Error);
    }
  }
);

async function insertBatch(batch: any[]) {
  if (batch.length === 0) return;

  for (const row of batch) {
    try {
      await db.exec`
        INSERT INTO imported_data (source_id, hexacle, numero, voie, ville, cod_post, cod_insee)
        VALUES (${row.source_id}, ${row.hexacle}, ${row.numero}, ${row.voie}, ${row.ville}, ${row.cod_post}, ${row.cod_insee})
      `;
    } catch (e: any) {
      console.error(`Failed to insert row: ${JSON.stringify(row)}`, e.message);
    }
  }
}