import type { EnrichmentSource } from "../settings/types";

export type ImportColumn =
  | "hexacle"
  | "numero"
  | "voie"
  | "ville"
  | "cod_post"
  | "cod_insee";

const SUPPORTED_COLUMNS: ReadonlySet<ImportColumn> = new Set([
  "hexacle",
  "numero",
  "voie",
  "ville",
  "cod_post",
  "cod_insee",
]);

export interface ImportRecord {
  source_id: string;
  hexacle: string | null;
  numero: string | null;
  voie: string | null;
  ville: string | null;
  cod_post: string | null;
  cod_insee: string | null;
}

export class MappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MappingError";
  }
}

export type SourceRow = Pick<EnrichmentSource, "id" | "name" | "filePath" | "hasHeaders" | "delimiter"> & {
  mapping: string;
};

export function parseMapping(mappingJson: string): Map<ImportColumn, string> {
  if (!mappingJson || mappingJson.trim().length === 0) {
    throw new MappingError("Mapping configuration is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(mappingJson);
  } catch {
    throw new MappingError("Mapping configuration is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MappingError("Mapping configuration must be an object.");
  }

  const mapping = new Map<ImportColumn, string>();
  for (const [sourceColumn, destinationColumn] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof destinationColumn !== "string" || destinationColumn.trim().length === 0) {
      throw new MappingError(`Invalid destination column for source "${sourceColumn}".`);
    }

    const normalizedDestination = normalizeColumnKey(destinationColumn);
    if (!isSupportedColumn(normalizedDestination)) {
      continue;
    }

    mapping.set(normalizedDestination, sourceColumn.trim());
  }

  if (mapping.size === 0) {
    throw new MappingError(
      "Mapping configuration does not contain any supported destination columns.",
    );
  }

  return mapping;
}

export function mapCsvRowToImportRecord(
  row: Record<string, unknown>,
  mapping: Map<ImportColumn, string>,
  sourceId: number | string,
): ImportRecord {
  const lookup = buildLookup(row);

  const record: ImportRecord = {
    source_id: String(sourceId),
    hexacle: null,
    numero: null,
    voie: null,
    ville: null,
    cod_post: null,
    cod_insee: null,
  };

  for (const [destination, sourceColumn] of mapping.entries()) {
    const value = lookup.get(normalizeColumnKey(sourceColumn));
    record[destination] = normalizeValue(value);
  }

  return record;
}

function buildLookup(row: Record<string, unknown>): Map<string, unknown> {
  const lookup = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    if (typeof key !== "string") continue;
    lookup.set(normalizeColumnKey(key), value);
  }

  return lookup;
}

function normalizeValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  return String(value);
}

function normalizeColumnKey(column: string): ImportColumn | string {
  return column.trim().toLowerCase();
}

function isSupportedColumn(column: string): column is ImportColumn {
  return SUPPORTED_COLUMNS.has(column as ImportColumn);
}

export function hasMappedValue(record: ImportRecord, mapping: Map<ImportColumn, string>): boolean {
  for (const destination of mapping.keys()) {
    if (record[destination] !== null) {
      return true;
    }
  }
  return false;
}
