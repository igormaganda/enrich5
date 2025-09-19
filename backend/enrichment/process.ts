import { api, APIError } from "encore.dev/api";
import { createReadStream } from "fs";
import csv from "csv-parser";
import { v4 as uuidv4 } from "uuid";

import { enrichmentDB as db } from "./db";
import type { StartImportRequest, StartImportResponse } from "./types";
import {
  parseMapping,
  mapCsvRowToImportRecord,
  MappingError,
  type ImportRecord,
  type SourceRow,
  hasMappedValue,
} from "./importer";

export const startImport = api<StartImportRequest, StartImportResponse>(
  { expose: true, method: "POST", path: "/enrichment/start-import" },
  async ({ sourceId }) => {
    let jobId: string | null = null;
    let recordsProcessed = 0;
    let jobCreated = false;

    try {
      const source = await loadSource(sourceId);

      jobId = uuidv4();
      await createJobHistory(jobId, sourceId, source.name);
      jobCreated = true;

      const mapping = parseMapping(source.mapping);
      const stream = createCsvStream(source);

      let batch: ImportRecord[] = [];

      for await (const row of stream as AsyncIterable<Record<string, unknown>>) {
        const record = mapCsvRowToImportRecord(row, mapping, sourceId);
        if (!hasMappedValue(record, mapping)) {
          continue;
        }

        batch.push(record);

        if (batch.length >= BATCH_SIZE) {
          recordsProcessed += await insertBatch(batch);
          await updateRecordsProcessed(jobId, recordsProcessed);
          batch = [];
        }
      }

      if (batch.length > 0) {
        recordsProcessed += await insertBatch(batch);
        await updateRecordsProcessed(jobId, recordsProcessed);
      }

      await markJobCompleted(jobId, recordsProcessed);

      return { success: true, jobId, recordsProcessed };
    } catch (error) {
      if (jobCreated && jobId) {
        await markJobFailed(jobId, error);
      }

      if (error instanceof MappingError) {
        throw APIError.invalidArgument(error.message);
      }

      if (error instanceof APIError) {
        throw error;
      }

      throw APIError.internal("Failed to import data", error as Error);
    }
  }
);

const BATCH_SIZE = 500;

async function loadSource(sourceId: number): Promise<SourceRow> {
  const source = await db.queryRow<SourceRow>`
    SELECT id, name, file_path as "filePath", has_headers as "hasHeaders", delimiter, mapping
    FROM enrichment_sources
    WHERE id = ${sourceId}
  `;

  if (!source) {
    throw APIError.notFound("Source not found");
  }

  return source;
}

async function createJobHistory(jobId: string, sourceId: number, sourceName: string): Promise<void> {
  await db.exec`
    INSERT INTO job_history (job_id, source_id, filename, status, file_type, created_by, started_at)
    VALUES (${jobId}, ${sourceId}, ${sourceName}, 'processing', 'enrichment_import', 'system', NOW())
  `;
}

function createCsvStream(source: SourceRow) {
  const readStream = createReadStream(source.filePath);
  const parser = csv({
    separator: source.delimiter && source.delimiter.length > 0 ? source.delimiter : ",",
    headers: source.hasHeaders,
    mapHeaders: ({ header, index }) => (header ? header.trim() : index.toString()),
  });

  readStream.on("error", (error) => {
    parser.destroy(error);
  });

  return readStream.pipe(parser);
}

async function insertBatch(batch: ImportRecord[]): Promise<number> {
  if (batch.length === 0) {
    return 0;
  }

  const payload = JSON.stringify(
    batch.map((row) => ({
      source_id: row.source_id,
      hexacle: row.hexacle,
      numero: row.numero,
      voie: row.voie,
      ville: row.ville,
      cod_post: row.cod_post,
      cod_insee: row.cod_insee,
    })),
  );

  await db.exec`
    INSERT INTO imported_data (source_id, hexacle, numero, voie, ville, cod_post, cod_insee)
    SELECT source_id, hexacle, numero, voie, ville, cod_post, cod_insee
    FROM json_to_recordset(${payload}) AS t(
      source_id text,
      hexacle text,
      numero text,
      voie text,
      ville text,
      cod_post text,
      cod_insee text
    )
  `;

  return batch.length;
}

async function updateRecordsProcessed(jobId: string, recordsProcessed: number): Promise<void> {
  await db.exec`
    UPDATE job_history
    SET records_processed = ${recordsProcessed}
    WHERE job_id = ${jobId}
  `;
}

async function markJobCompleted(jobId: string, recordsProcessed: number): Promise<void> {
  await db.exec`
    UPDATE job_history
    SET status = 'completed', records_processed = ${recordsProcessed}, completed_at = NOW()
    WHERE job_id = ${jobId}
  `;
}

async function markJobFailed(jobId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.exec`
    UPDATE job_history
    SET status = 'failed', error_message = ${message}, completed_at = NOW()
    WHERE job_id = ${jobId}
  `;
}
