import { api, APIError } from "encore.dev/api";
import { settingsDB } from "./db";
import type {
  AppSettings,
  GetSettingsRequest,
  UpdateSettingsRequest,
  SettingsResponse,
  ResetSettingsRequest,
  InitializeSettingsRequest,
  CreateEnrichmentSourceRequest,
  EnrichmentSource,
  ListEnrichmentSourcesResponse,
  DeleteEnrichmentSourceRequest,
  PreviewEnrichmentSourceRequest,
  PreviewEnrichmentSourceResponse,
  CreateSourceConfigurationRequest,
  SourceConfiguration,
} from "./types";
import fs from "fs/promises";
import path from "path";
import os from "os";
import csv from "csv-parser";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";

// Helper to get the storage path for enrichment sources
async function getSourceStoragePath(
  sourceId: string,
  filename: string
): Promise<string> {
  const storageDir = path.join(os.tmpdir(), "enrichment_sources");
  await fs.mkdir(storageDir, { recursive: true });
  return path.join(storageDir, `${sourceId}-${filename}`);
}

// Create a new enrichment source
export const createSource = api<
  CreateEnrichmentSourceRequest,
  EnrichmentSource
>(
  {
    expose: true,
    method: "POST",
    path: "/settings/enrichment-sources",
    bodyLimit: null,
  },
  async (req) => {
    // Validation
    if (!req.name) {
      throw APIError.invalidArgument("Source name is required");
    }
    if (!req.filePath) {
      throw APIError.invalidArgument("File content is required");
    }
    if (
      !req.hasHeaders &&
      (!req.mapping ||
        Object.values(req.mapping).some((v) => !v || v.trim() === ""))
    ) {
      throw APIError.invalidArgument(
        "Mapping is required and all columns must be mapped when the file has no headers"
      );
    }

    let sourceId: number;
    let filePath: string = "";

    try {
      // 1. Insert metadata to get the new ID
      const initialResult = await settingsDB.queryRow<{ id: number }>`
        INSERT INTO enrichment_sources (name, has_headers, delimiter, mapping, file_path)
        VALUES (${req.name}, ${req.hasHeaders}, ${
        req.delimiter
      }, ${JSON.stringify(req.mapping)}, '')
        RETURNING id
      `;
      if (!initialResult) {
        throw new Error("Failed to get new source ID");
      }
      sourceId = initialResult.id;

      // 2. Construct final file path and save the file
      filePath = await getSourceStoragePath(sourceId.toString(), req.name);
      await fs.writeFile(filePath, req.filePath);

      // 3. Update the record with the final file path
      await settingsDB.exec`
        UPDATE enrichment_sources
        SET file_path = ${filePath}
        WHERE id = ${sourceId}
      `;

      // 4. Return the final created source
      const finalResult = await settingsDB.queryRow<
        EnrichmentSource & { mapping: string }
      >`
        SELECT id, name, file_path as "filePath", has_headers as "hasHeaders", delimiter, mapping, is_default as "isDefault", created_at as "createdAt", updated_at as "updatedAt"
        FROM enrichment_sources
        WHERE id = ${sourceId}
      `;
      if (!finalResult) {
        throw new Error("Could not retrieve created source");
      }

      if (typeof finalResult.mapping === "string") {
        finalResult.mapping = JSON.parse(finalResult.mapping);
      }

      return finalResult as EnrichmentSource;
    } catch (error) {
      // Cleanup in case of error
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (e) {
          /* ignore */
        }
      }
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(
        "Failed to create enrichment source",
        error as Error
      );
    }
  }
);

// List all enrichment sources
export const listSources = api<void, ListEnrichmentSourcesResponse>(
  { expose: true, method: "GET", path: "/settings/enrichment-sources" },
  async () => {
    try {
      const results = await settingsDB.queryAll<
        EnrichmentSource & { mapping: string }
      >`
        SELECT id, name, file_path as "filePath", has_headers as "hasHeaders", delimiter, mapping, is_default as "isDefault", created_at as "createdAt", updated_at as "updatedAt"
        FROM enrichment_sources
        ORDER BY created_at DESC
      `;

      const sources = results.map((source) => {
        if (typeof source.mapping === "string") {
          try {
            return { ...source, mapping: JSON.parse(source.mapping) };
          } catch (e) {
            console.error(`Failed to parse mapping for source ${source.id}`, e);
            // Return source with empty mapping if parsing fails
            return { ...source, mapping: {} };
          }
        }
        return source;
      });

      return { sources };
    } catch (error) {
      throw APIError.internal(
        "Failed to list enrichment sources",
        error as Error
      );
    }
  }
);

// Delete an enrichment source
export const deleteSource = api<
  DeleteEnrichmentSourceRequest,
  { success: boolean; message: string }
>(
  { expose: true, method: "DELETE", path: "/settings/enrichment-sources/:id" },
  async (req) => {
    try {
      await settingsDB.exec`DELETE FROM enrichment_sources WHERE id = ${req.id}`;
      return { success: true, message: "Source deleted" };
    } catch (error) {
      throw APIError.internal(
        "Failed to delete enrichment source",
        error as Error
      );
    }
  }
);

// Preview an enrichment source file
// Helper to calculate a fingerprint for a file structure
function calculateFingerprint(
  headers: string[],
  hasHeaders: boolean,
  firstRow?: string[]
): string {
  const relevantColumns = hasHeaders ? headers : firstRow || [];
  return relevantColumns.sort().join("|"); // Simple concatenation for now
}

// Create a new source configuration
export const createSourceConfiguration = api<
  CreateSourceConfigurationRequest & { fingerprint?: string },
  SourceConfiguration
>(
  { expose: true, method: "POST", path: "/settings/source-configurations" },
  async (req) => {
    try {
      // Use fingerprint if provided, otherwise fall back to name
      const fingerprint = req.fingerprint || req.name;
      
      const result = await settingsDB.queryRow<SourceConfiguration>`
        INSERT INTO source_configurations (fingerprint, mapping, delimiter)
        VALUES (${fingerprint}, ${JSON.stringify(req.mapping)}, ${req.delimiter})
        ON CONFLICT (fingerprint) DO UPDATE SET
          mapping = EXCLUDED.mapping,
          delimiter = EXCLUDED.delimiter,
          updated_at = NOW()
        RETURNING id, fingerprint as name, mapping, delimiter, created_at as "createdAt", updated_at as "updatedAt"
      `;
      if (!result) {
        throw APIError.internal("Failed to save source configuration");
      }
      return result;
    } catch (error) {
      throw APIError.internal(
        "Failed to save source configuration",
        error as Error
      );
    }
  }
);

// Preview an enrichment source file
export const previewEnrichmentSource = api<
  PreviewEnrichmentSourceRequest,
  PreviewEnrichmentSourceResponse
>(
  {
    expose: true,
    method: "POST",
    path: "/settings/enrichment-sources/preview",
    bodyLimit: null,
  },
  async (req) => {
    try {
      const fileContent = req.filePath;
      const limit = req.limit || 5;

      // First, parse the file to get headers/structure
      const rows: string[][] = [];
      let headers: string[] = [];
      let firstRow: string[] | undefined = undefined;
      let totalRows = 0;

      const parser = Readable.from(fileContent).pipe(
        csv(
          req.hasHeaders
            ? {
                separator: req.delimiter,
                headers: true,
                mapHeaders: ({ header }) => header.trim(),
              }
            : { separator: req.delimiter, headers: false }
        )
      );

      let isFirstRowLogic = true;
      for await (const row of parser) {
        if (isFirstRowLogic) {
          if (req.hasHeaders) {
            headers = Object.keys(row);
          } else {
            firstRow = (row as string[]).map(String);
            headers = firstRow.map((_, i) => `Colonne ${i + 1}`);
          }
          isFirstRowLogic = false;
        }

        if (rows.length < limit) {
          if (req.hasHeaders) {
            rows.push(Object.values(row).map(String));
          } else {
            rows.push((row as string[]).map(String));
          }
        }
        totalRows++;
      }

      // Calculate fingerprint based on file structure
      const fingerprint = calculateFingerprint(headers, req.hasHeaders, firstRow);
      
      // Find saved configuration by fingerprint
      let savedConfigFromDb = await settingsDB.queryRow<{
        id: string;
        name: string;
        mapping: string; // Comes as JSON string from DB
        delimiter: string;
        createdAt: string;
        updatedAt: string;
      }>`
        SELECT id, fingerprint as name, mapping, delimiter, created_at as "createdAt", updated_at as "updatedAt"
        FROM source_configurations
        WHERE fingerprint = ${fingerprint}
      `;

      let savedConfiguration: SourceConfiguration | undefined = undefined;
      if (savedConfigFromDb) {
        try {
          savedConfiguration = {
            ...savedConfigFromDb,
            mapping: JSON.parse(savedConfigFromDb.mapping),
          };
        } catch (e) {
          console.error("Failed to parse saved configuration mapping:", e);
          // If parsing fails, treat as if no config was found
        }
      }

      return {
        headers,
        rows,
        firstRow,
        totalRows,
        hasMore: totalRows > limit,
        savedConfiguration: savedConfiguration,
        fingerprint: fingerprint, // Include fingerprint in response
      };
    } catch (error) {
      console.error("Error in previewEnrichmentSource:", error);
      throw APIError.internal(
        "Failed to preview enrichment source",
        error as Error
      );
    }
  }
);

// Récupère les paramètres de l'application

export const getSettings = api<GetSettingsRequest, SettingsResponse>(
  { expose: true, method: "GET", path: "/settings" },
  async (req) => {
    try {
      console.log("Getting settings, section:", req.section);

      const dbSettings = await settingsDB.queryAll<{
        section: string;
        key: string;
        value: string;
        valueType: string;
      }>`
        SELECT section, key, value, value_type as "valueType"
        FROM app_settings 
        ORDER BY section, key
      `;

      console.log("DB settings found:", dbSettings.length);

      const settings = buildSettingsObject(dbSettings);
      console.log("Built settings object:", Object.keys(settings));

      return {
        success: true,
        settings,
      };
    } catch (error) {
      console.error("Error in getSettings:", error);
      throw APIError.internal("Failed to get settings", error as Error);
    }
  }
);

// Met à jour les paramètres de l'application
export const updateSettings = api<UpdateSettingsRequest, SettingsResponse>(
  { expose: true, method: "PUT", path: "/settings" },
  async (req) => {
    try {
      // Flatten les paramètres pour mise à jour en base
      const updates = flattenSettings(req.settings);

      for (const { section, key, value, valueType } of updates) {
        await settingsDB.exec`
          INSERT INTO app_settings (section, key, value, value_type, updated_at)
          VALUES (${section}, ${key}, ${value}, ${valueType}, NOW())
          ON CONFLICT (section, key) 
          DO UPDATE SET 
            value = EXCLUDED.value,
            value_type = EXCLUDED.value_type,
            updated_at = NOW()
        `;
      }

      // Retourne les paramètres mis à jour
      const updatedSettings = await getSettings({});

      return updatedSettings;
    } catch (error) {
      throw APIError.internal("Failed to update settings", error as Error);
    }
  }
);

// Initialise les paramètres par défaut si la table est vide
export const initializeSettings = api<
  InitializeSettingsRequest,
  SettingsResponse
>({ expose: true, method: "POST", path: "/settings/initialize" }, async () => {
  try {
    console.log("Initializing default settings...");

    // Vérifier si des paramètres existent déjà
    const existingSettings = await settingsDB.queryAll<{ count: number }>`
        SELECT COUNT(*) as count FROM app_settings
      `;

    if (existingSettings[0]?.count > 0) {
      console.log("Settings already exist, skipping initialization");
      return await getSettings({});
    }

    // Insérer les paramètres par défaut
    const defaultSettings = getDefaultSettings();
    const updates = flattenSettings(defaultSettings);

    console.log("Inserting", updates.length, "default settings");

    for (const { section, key, value, valueType } of updates) {
      try {
        await settingsDB.exec`
            INSERT INTO app_settings (section, key, value, value_type)
            VALUES (${section}, ${key}, ${value}, ${valueType})
          `;
      } catch (insertError) {
        console.warn(
          "Failed to insert setting:",
          { section, key },
          insertError
        );
      }
    }

    console.log("Default settings initialized");

    // Retourner les paramètres initialisés
    return await getSettings({});
  } catch (error) {
    console.error("Error in initializeSettings:", error);

    // En cas d'erreur, retourner les paramètres par défaut directement
    return {
      success: true,
      settings: getDefaultSettings(),
    };
  }
});
// Remet les paramètres par défaut
export const resetSettings = api<ResetSettingsRequest, SettingsResponse>(
  { expose: true, method: "POST", path: "/settings/reset" },
  async (req) => {
    try {
      console.log("Resetting settings, section:", req.section);

      if (req.section) {
        // Supprimer seulement une section
        await settingsDB.exec`
          DELETE FROM app_settings WHERE section = ${getSectionDbName(
            req.section
          )}
        `;
      } else {
        // Supprimer tous les paramètres
        await settingsDB.exec`
          DELETE FROM app_settings
        `;
      }

      // Recrée les paramètres par défaut
      const defaultSettings = getDefaultSettings();
      const updates = flattenSettings(
        req.section
          ? { [req.section]: defaultSettings[req.section] }
          : defaultSettings
      );

      for (const { section, key, value, valueType } of updates) {
        await settingsDB.exec`
          INSERT INTO app_settings (section, key, value, value_type)
          VALUES (${section}, ${key}, ${value}, ${valueType})
        `;
      }

      console.log("Settings reset completed");

      const resetSettings = await getSettings({});

      return resetSettings;
    } catch (error) {
      console.error("Error in resetSettings:", error);
      throw APIError.internal("Failed to reset settings", error as Error);
    }
  }
);

export const setSourceDefaultStatus = api<
  { id: string; isDefault: boolean },
  { success: boolean }
>(
  {
    expose: true,
    method: "PUT",
    path: "/settings/enrichment-sources/:id/default",
  },
  async ({ id, isDefault }) => {
    try {
      await settingsDB.exec`
        UPDATE enrichment_sources
        SET is_default = ${isDefault}
        WHERE id = ${parseInt(id, 10)}
      `;
      return { success: true };
    } catch (error) {
      throw APIError.internal(
        "Failed to update source default status",
        error as Error
      );
    }
  }
);

export const previewSourceFile = api<
  { id: number },
  PreviewEnrichmentSourceResponse
>(
  {
    expose: true,
    method: "GET",
    path: "/settings/enrichment-sources/:id/preview",
  },
  async ({ id }) => {
    try {
      const source = await settingsDB.queryRow<EnrichmentSource>`
        SELECT id, name, file_path as "filePath", has_headers as "hasHeaders", delimiter, mapping, is_default as "isDefault", created_at as "createdAt", updated_at as "updatedAt"
        FROM enrichment_sources
        WHERE id = ${id}
      `;

      if (!source) {
        throw APIError.notFound("Source not found");
      }

      const fileContent = await fs.readFile(source.filePath, "utf-8");
      const limit = 5;

      const rows: string[][] = [];
      let headers: string[] = [];
      let firstRow: string[] | undefined = undefined;
      let totalRows = 0;

      const parser = Readable.from(fileContent).pipe(
        csv(
          source.hasHeaders
            ? {
                separator: source.delimiter,
                headers: true,
                mapHeaders: ({ header }) => header.trim(),
              }
            : { separator: source.delimiter, headers: false }
        )
      );

      let isFirstRowLogic = true;
      for await (const row of parser) {
        if (isFirstRowLogic) {
          if (source.hasHeaders) {
            headers = Object.keys(row);
          } else {
            firstRow = (row as string[]).map(String);
            headers = firstRow.map((_, i) => `Colonne ${i + 1}`);
          }
          isFirstRowLogic = false;
        }

        if (rows.length < limit) {
          if (source.hasHeaders) {
            rows.push(Object.values(row).map(String));
          } else {
            rows.push((row as string[]).map(String));
          }
        }
        totalRows++;
      }

      return {
        headers,
        rows,
        firstRow,
        totalRows,
        hasMore: totalRows > limit,
      };
    } catch (error) {
      console.error("Error in previewSourceFile:", error);
      throw APIError.internal(
        "Failed to preview source file",
        error as Error
      );
    }
  }
);

function getSectionDbName(sectionKey: keyof AppSettings): string {
  const mapping: Record<keyof AppSettings, string> = {
    emailSettings: "email",
    processingSettings: "processing",
    fileSettings: "file",
    uiSettings: "ui",
    systemSettings: "system",
    ftpSettings: "ftp",
  };
  return mapping[sectionKey] || sectionKey;
}

function buildSettingsObject(
  dbSettings: Array<{
    section: string;
    key: string;
    value: string;
    valueType: string;
  }>
): AppSettings {
  // Si aucun paramètre en base, retourner les valeurs par défaut
  if (!dbSettings || dbSettings.length === 0) {
    console.log("No settings in DB, returning defaults");
    return getDefaultSettings();
  }

  const settings: any = {
    emailSettings: {},
    processingSettings: {},
    fileSettings: {},
    uiSettings: {},
    systemSettings: {},
    ftpSettings: {},
  };

  for (const setting of dbSettings) {
    const sectionKey = getSectionKey(setting.section);
    if (!sectionKey) {
      console.warn("Unknown section:", setting.section);
      continue;
    }

    let parsedValue: any = setting.value;

    try {
      switch (setting.valueType) {
        case "number":
          parsedValue = parseInt(setting.value, 10);
          if (isNaN(parsedValue)) {
            console.warn("Invalid number value:", setting.value);
            parsedValue = 0;
          }
          break;
        case "boolean":
          parsedValue = setting.value === "true";
          break;
        case "json":
          try {
            parsedValue = JSON.parse(setting.value);
          } catch (e) {
            console.warn("Invalid JSON value:", setting.value);
            parsedValue = setting.value;
          }
          break;
        default:
          parsedValue = setting.value;
      }
    } catch (e) {
      console.warn("Error parsing setting value:", setting, e);
      parsedValue = setting.value;
    }

    settings[sectionKey][setting.key] = parsedValue;
  }

  // Merger avec les valeurs par défaut pour s'assurer qu'on a toutes les clés
  const defaultSettings = getDefaultSettings();
  return {
    emailSettings: {
      ...defaultSettings.emailSettings,
      ...settings.emailSettings,
    },
    processingSettings: {
      ...defaultSettings.processingSettings,
      ...settings.processingSettings,
    },
    fileSettings: { ...defaultSettings.fileSettings, ...settings.fileSettings },
    uiSettings: { ...defaultSettings.uiSettings, ...settings.uiSettings },
    systemSettings: {
      ...defaultSettings.systemSettings,
      ...settings.systemSettings,
    },
    ftpSettings: {
      ...defaultSettings.ftpSettings,
      ...settings.ftpSettings,
    },
  };
}

function getSectionKey(section: string): keyof AppSettings | null {
  const mapping: Record<string, keyof AppSettings> = {
    email: "emailSettings",
    processing: "processingSettings",
    file: "fileSettings",
    ui: "uiSettings",
    system: "systemSettings",
    ftp: "ftpSettings",
  };
  return mapping[section] || null;
}

function flattenSettings(settings: Partial<AppSettings>): Array<{
  section: string;
  key: string;
  value: string;
  valueType: string;
}> {
  const flattened: Array<{
    section: string;
    key: string;
    value: string;
    valueType: string;
  }> = [];

  const sectionMapping: Record<keyof AppSettings, string> = {
    emailSettings: "email",
    processingSettings: "processing",
    fileSettings: "file",
    uiSettings: "ui",
    systemSettings: "system",
    ftpSettings: "ftp",
  };

  for (const [sectionKey, sectionData] of Object.entries(settings)) {
    const section = sectionMapping[sectionKey as keyof AppSettings];
    if (!section || !sectionData) continue;

    for (const [key, value] of Object.entries(sectionData)) {
      let valueType = "string";
      let stringValue = String(value);

      if (typeof value === "number") {
        valueType = "number";
      } else if (typeof value === "boolean") {
        valueType = "boolean";
      } else if (typeof value === "object") {
        valueType = "json";
        stringValue = JSON.stringify(value);
      }

      flattened.push({
        section,
        key,
        value: stringValue,
        valueType,
      });
    }
  }

  return flattened;
}

function getDefaultSettings(): AppSettings {
  return {
    emailSettings: {
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "hackersranch@gmail.com",
      smtpPassword: "wftu sloa kpsq wecy",
      fromAddress: "hackersranch@gmail.com",
      fromName: "Plateforme d'Enrichissement",
      enableNotifications: true,
    },
    processingSettings: {
      maxConcurrentJobs: 5,
      defaultTimeout: 30,
      autoRefreshInterval: 5,
      retryAttempts: 3,
      enableAutoCleanup: true,
      cleanupAfterDays: 30,
    },
    fileSettings: {
      maxFileSize: 100,
      allowedFormats: ["zip", "csv", "xlsx"],
      separator: ";",
      compressionFormat: "zip",
      enablePreview: true,
      previewRowLimit: 10,
    },
    uiSettings: {
      appName: "Plateforme d'Enrichissement de Données",
      appDescription: "Système automatisé d'enrichissement de données client",
      theme: "light",
      language: "fr",
      enableAnimations: true,
      itemsPerPage: 20,
    },
    systemSettings: {
      enableDebugLogs: false,
      enableMetrics: true,
      maintenanceMode: false,
      maintenanceMessage: "Maintenance en cours. Merci de revenir plus tard.",
    },
    ftpSettings: {
      globalEnabled: true,
      defaultPollInterval: 60,
      maxConcurrentDownloads: 3,
      downloadTimeout: 300,
      retryAttempts: 3,
      retryDelay: 30,
      tempDirectory: "/tmp/ftp-downloads",
      enableNotifications: true,
    },
  };
}
