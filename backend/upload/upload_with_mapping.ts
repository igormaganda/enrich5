import { api } from "encore.dev/api";
import csv from "csv-parser";
import { Readable } from "stream";
import type { ColumnMapping } from "./mapping";
import db from "../db";

export interface UploadWithMappingRequest {
  csvContent: string;
  columnMappings: ColumnMapping[];
  delimiter?: string;
}

export interface UploadWithMappingResponse {
  success: boolean;
  totalRows: number;
  errors: string[];
}

export const uploadWithMapping = api<UploadWithMappingRequest, UploadWithMappingResponse>(
  { expose: true, method: "POST", path: "/upload/with-mapping", bodyLimit: null },
  async ({ csvContent, columnMappings, delimiter = "," }) => {
    const readable = Readable.from(csvContent);
    const parser = readable.pipe(csv({ separator: delimiter }));

    const batchSize = 100;
    let batch: any[] = [];
    let totalRows = 0;
    const errors: string[] = [];

    // Create mapping lookup
    const mappingLookup = new Map<string, ColumnMapping>();
    for (const mapping of columnMappings) {
      if (mapping.dbColumn) {
        mappingLookup.set(mapping.csvHeader, mapping);
      }
    }

    for await (const row of parser) {
      try {
        const mappedRow = mapRowToDatabase(row, mappingLookup);
        if (mappedRow) {
          batch.push(mappedRow);
        }
      } catch (error: any) {
        errors.push(`Row ${totalRows + 1}: ${error.message}`);
      }

      if (batch.length >= batchSize) {
        const batchErrors = await insertContactBatchWithMapping(batch);
        errors.push(...batchErrors);
        totalRows += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      const batchErrors = await insertContactBatchWithMapping(batch);
      errors.push(...batchErrors);
      totalRows += batch.length;
    }

    return { 
      success: errors.length === 0, 
      totalRows,
      errors: errors.slice(0, 10) // Limit to first 10 errors
    };
  }
);

function mapRowToDatabase(csvRow: any, mappingLookup: Map<string, ColumnMapping>): any | null {
  const dbRow: any = {};
  let hasValidData = false;

  for (const [csvHeader, value] of Object.entries(csvRow)) {
    // Uniquement traiter les colonnes explicitement mappées
    const mapping = mappingLookup.get(csvHeader);
    if (!mapping || !mapping.dbColumn || !value || value === '') {
      continue;
    }

    // Skip id and source_id columns
    if (mapping.dbColumn === 'id' || mapping.dbColumn === 'source_id') {
      continue;
    }

    try {
      const convertedValue = convertValue(String(value), mapping.dataType);
      if (convertedValue !== null) {
        dbRow[mapping.dbColumn] = convertedValue;
        hasValidData = true;
      }
    } catch (error: any) {
      throw new Error(`Failed to convert "${csvHeader}" value "${value}": ${error.message}`);
    }
  }

  // Generate Hexacle_hash automatically si on a des données valides
  if (hasValidData) {
    dbRow.hexacle_hash = generateHexacleHash(dbRow);
  }

  return hasValidData ? dbRow : null;
}

function convertValue(value: string, dataType: string): any {
  const trimmedValue = value.trim();
  
  if (!trimmedValue) {
    return null;
  }

  switch (dataType) {
    case "string":
      // Ensure string values don't cause serialization issues
      // Remove null bytes and control characters
      const sanitized = trimmedValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      if (sanitized.length === 0) {
        return null;
      }
      // Ensure proper UTF-8 encoding and limit length
      const stringValue = Buffer.from(sanitized, 'utf8').toString('utf8').substring(0, 500);
      return stringValue || null;
      
    case "integer":
      // More robust integer parsing to handle serialization errors
      const numberValue = parseFloat(trimmedValue);
      if (isNaN(numberValue)) {
        console.warn(`Non-numeric value for integer field: "${trimmedValue}", using null`);
        return null;
      }
      
      // Check if it's within PostgreSQL integer range
      const intValue = Math.floor(numberValue);
      if (intValue < -2147483648 || intValue > 2147483647) {
        console.warn(`Integer value out of range: ${intValue}, using null`);
        return null;
      }
      
      return intValue;
      
    case "boolean":
      const lowerValue = trimmedValue.toLowerCase();
      if (["true", "1", "yes", "oui", "y", "vrai"].includes(lowerValue)) {
        return true;
      } else if (["false", "0", "no", "non", "n", "faux"].includes(lowerValue)) {
        return false;
      } else if (trimmedValue === "") {
        return null;
      }
      // For non-boolean values, return null instead of error
      console.warn(`Non-boolean value for boolean field: "${trimmedValue}", using null`);
      return null;
      
    case "date":
      try {
        return parseDate(trimmedValue);
      } catch (error) {
        console.warn(`Date parsing error: "${trimmedValue}", using null`);
        return null;
      }
      
    case "datetime":
      try {
        return parseDateTime(trimmedValue);
      } catch (error) {
        console.warn(`DateTime parsing error: "${trimmedValue}", using null`);
        return null;
      }
      
    default:
      return trimmedValue;
  }
}

function parseDate(dateStr: string): string | null {
  // Support multiple date formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let [, part1, part2, part3] = match;
      
      // For DD/MM/YYYY format (European)
      if (format === formats[0] && parseInt(part1) <= 12 && parseInt(part2) > 12) {
        // If first part is <= 12 and second > 12, assume DD/MM/YYYY
        return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
      } else if (format === formats[0]) {
        // Otherwise assume MM/DD/YYYY
        return `${part3}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
      } else if (format === formats[1]) {
        // YYYY-MM-DD
        return `${part1}-${part2.padStart(2, '0')}-${part3.padStart(2, '0')}`;
      } else if (format === formats[2]) {
        // DD-MM-YYYY
        return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
      }
    }
  }
  
  throw new Error(`Unsupported date format: ${dateStr}`);
}

function parseDateTime(dateTimeStr: string): string | null {
  // Try to parse as date first
  try {
    const dateOnly = parseDate(dateTimeStr.split(' ')[0]);
    if (dateOnly) {
      // If there's time component, add it
      const timePart = dateTimeStr.split(' ')[1];
      if (timePart) {
        return `${dateOnly} ${timePart}`;
      } else {
        return `${dateOnly} 00:00:00`;
      }
    }
  } catch {
    // Fall back to trying direct conversion
  }
  
  // Try ISO format
  const isoDate = new Date(dateTimeStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }
  
  throw new Error(`Unsupported datetime format: ${dateTimeStr}`);
}

function generateHexacleHash(row: any): string {
  // Concatenation: adresse + ville + code postal
  const components = [
    row.adresse || '',
    row.ville || '',
    row.code_postal || ''
  ];
  
  return components
    .filter(component => component.trim() !== '')
    .map(component => component.trim().toUpperCase())
    .join('');
}

function validateAndCleanRowData(row: any): any {
  const cleaned: any = {};
  
  // Fonction helper pour valider et nettoyer chaque champ
  const cleanField = (fieldName: string, value: any, validator?: (val: any) => any) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    
    if (validator) {
      try {
        const result = validator(value);
        // Additional check to ensure the result is not problematic
        if (result === undefined) {
          return null;
        }
        return result;
      } catch (error) {
        console.warn(`Validation failed for ${fieldName}: ${JSON.stringify(value)}, using null:`, error);
        return null;
      }
    }
    
    // Default string cleaning for fields without custom validator
    if (typeof value === 'string') {
      const sanitized = value.trim().replace(/[ --]/g, '');
      return sanitized.length > 0 ? sanitized : null;
    }
    
    return value;
  };
  
  // Fonction de nettoyage spéciale pour les chaînes avec longueur limitée
  const cleanStringField = (maxLength: number) => (val: any) => {
    if (val === null || val === undefined) {
      return null;
    }
    const str = String(val).trim();
    // Remove null bytes and control characters that can cause serialization issues
    const sanitized = str.replace(/[ --]/g, '');
    if (sanitized.length === 0) {
      return null;
    }
    // Ensure proper UTF-8 encoding and limit length
    const utf8Limited = Buffer.from(sanitized, 'utf8').toString('utf8').substring(0, maxLength);
    return utf8Limited || null;
  };

  // Valider et nettoyer chaque champ avec des limites appropriées
  // Identité personnelle
  cleaned.civilite = cleanField('civilite', row.civilite, cleanStringField(255));
  cleaned.prenom = cleanField('prenom', row.prenom, cleanStringField(255));
  cleaned.nom = cleanField('nom', row.nom, cleanStringField(255));
  cleaned.date_naissance = cleanField('date_naissance', row.date_naissance);
  
  // Validation spéciale pour age
  cleaned.age = cleanField('age', row.age, (val) => {
    if (val === null || val === undefined || val === '') {
      return null;
    }
    const strVal = String(val).trim();
    const numericStr = strVal.replace(/[^0-9.-]/g, '');
    if (numericStr === '' || numericStr === '.' || numericStr === '-') {
      return null;
    }
    const numVal = parseFloat(numericStr);
    if (isNaN(numVal) || !isFinite(numVal)) {
      return null;
    }
    const intVal = Math.floor(Math.abs(numVal));
    if (intVal < 0 || intVal > 150) {
      return null;
    }
    return intVal;
  });
  
  cleaned.profession = cleanField('profession', row.profession, cleanStringField(255));
  
  // Adresse personnelle
  cleaned.adresse = cleanField('adresse', row.adresse, cleanStringField(255));
  cleaned.adresse_complement = cleanField('adresse_complement', row.adresse_complement, cleanStringField(255));
  cleaned.code_postal = cleanField('code_postal', row.code_postal, cleanStringField(255));
  cleaned.ville = cleanField('ville', row.ville, cleanStringField(255));
  cleaned.departement = cleanField('departement', row.departement, cleanStringField(255));
  
  // Informations personnelles basiques
  cleaned.email = cleanField('email', row.email, cleanStringField(255));
  cleaned.mobile = cleanField('mobile', row.mobile, cleanStringField(255));
  cleaned.phone = cleanField('phone', row.phone, cleanStringField(255));
  
  // Famille
  cleaned.nb_enfants = cleanField('nb_enfants', row.nb_enfants, (val) => {
    const numVal = Number(val);
    if (isNaN(numVal)) return null;
    const intVal = Math.floor(numVal);
    return (intVal >= 0 && intVal <= 20) ? intVal : null;
  });
  
  cleaned.enfant1_date_naissance = cleanField('enfant1_date_naissance', row.enfant1_date_naissance);
  cleaned.enfant2_date_naissance = cleanField('enfant2_date_naissance', row.enfant2_date_naissance);
  cleaned.enfant3_date_naissance = cleanField('enfant3_date_naissance', row.enfant3_date_naissance);
  
  return cleaned;
}

async function insertContactBatchWithMapping(batch: any[]): Promise<string[]> {
  const errors: string[] = [];
  
  if (batch.length === 0) return errors;

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      const cleanedRow = validateAndCleanRowData(row);
      
      await db.exec`
        INSERT INTO contacts (
          civilite, nom, prenom, date_naissance, age, profession,
          adresse, adresse_complement, code_postal, ville, departement,
          email, mobile, phone, nb_enfants, enfant1_date_naissance,
          enfant2_date_naissance, enfant3_date_naissance, hexacle_hash
        )
        VALUES (
          ${cleanedRow.civilite},
          ${cleanedRow.nom},
          ${cleanedRow.prenom},
          ${cleanedRow.date_naissance},
          ${cleanedRow.age},
          ${cleanedRow.profession},
          ${cleanedRow.adresse},
          ${cleanedRow.adresse_complement},
          ${cleanedRow.code_postal},
          ${cleanedRow.ville},
          ${cleanedRow.departement},
          ${cleanedRow.email},
          ${cleanedRow.mobile},
          ${cleanedRow.phone},
          ${cleanedRow.nb_enfants},
          ${cleanedRow.enfant1_date_naissance},
          ${cleanedRow.enfant2_date_naissance},
          ${cleanedRow.enfant3_date_naissance},
          ${cleanedRow.hexacle_hash}
        )
      `;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }
  
  return errors;
}