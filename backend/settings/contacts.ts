import { api } from "encore.dev/api";
import csv from "csv-parser";
import { Readable } from "stream";
import type { ContactColumnMapping } from "./contact_mapping";
import db from "../db";

export interface UploadContactsRequest {
  file: string;
}

export interface UploadContactsWithMappingRequest {
  csvContent: string;
  columnMappings: ContactColumnMapping[];
  delimiter?: string;
}

export interface UploadContactsResponse {
  success: boolean;
  totalRows: number;
  errors?: string[];
}

// Endpoint original (legacy)
export const uploadContacts = api<UploadContactsRequest, UploadContactsResponse>(
  { expose: true, method: "POST", path: "/settings/contacts/upload", bodyLimit: null },
  async (req: UploadContactsRequest) => {
    const readable = Readable.from(req.file);
    const parser = readable.pipe(csv());

    const batchSize = 100;
    let batch: any[] = [];
    let totalRows = 0;

    for await (const row of parser) {
      batch.push(row);
      if (batch.length >= batchSize) {
        await insertContactBatch(batch);
        totalRows += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await insertContactBatch(batch);
      totalRows += batch.length;
    }

    return { success: true, totalRows };
  }
);

// Nouvel endpoint avec mapping
export const uploadContactsWithMapping = api<UploadContactsWithMappingRequest, UploadContactsResponse>(
  { expose: true, method: "POST", path: "/settings/contacts/upload-with-mapping", bodyLimit: null },
  async ({ csvContent, columnMappings, delimiter = "," }) => {
    const readable = Readable.from(csvContent);
    const parser = readable.pipe(csv({ separator: delimiter }));

    const batchSize = 100;
    let batch: any[] = [];
    let totalRows = 0;
    const errors: string[] = [];

    // Créer le lookup de mapping
    const mappingLookup = new Map<string, ContactColumnMapping>();
    for (const mapping of columnMappings) {
      if (mapping.dbColumn) {
        mappingLookup.set(mapping.csvHeader, mapping);
      }
    }

    for await (const row of parser) {
      try {
        const mappedRow = mapContactRowToDatabase(row, mappingLookup);
        if (mappedRow) {
          batch.push(mappedRow);
        }
      } catch (error: any) {
        errors.push(`Ligne ${totalRows + 1}: ${error.message}`);
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
      errors: errors.slice(0, 10) // Limiter aux 10 premières erreurs
    };
  }
);

function mapContactRowToDatabase(csvRow: any, mappingLookup: Map<string, ContactColumnMapping>): any | null {
  const dbRow: any = {};
  let hasValidData = false;
  const errors: string[] = [];

  for (const [csvHeader, value] of Object.entries(csvRow)) {
    const mapping = mappingLookup.get(csvHeader);
    if (!mapping || !mapping.dbColumn || !value) {
      continue;
    }

    // Skip id and source_id columns
    if (mapping.dbColumn === 'id' || mapping.dbColumn === 'id_source') {
      continue;
    }

    try {
      const convertedValue = convertContactValue(String(value), mapping.dataType);
      if (convertedValue !== null) {
        dbRow[mapping.dbColumn] = convertedValue;
        hasValidData = true;
      }
    } catch (error: any) {
      // Log the error but continue processing other fields
      console.warn(`Erreur conversion "${csvHeader}" valeur "${value}": ${error.message}`);
      errors.push(`${csvHeader}: ${error.message}`);
      // Don't add this field to the row, but continue processing
    }
  }

  // Générer automatiquement le hexacle_hash
  if (hasValidData) {
    const hashValue = generateHexacleHash(dbRow);
    dbRow.hexacle_hash = hashValue;
  }

  return hasValidData ? dbRow : null;
}

function convertContactValue(value: string, dataType: string): any {
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
      // Remove any non-numeric characters except decimal point and minus sign
      const numericStr = trimmedValue.replace(/[^0-9.-]/g, '');
      if (numericStr === '' || numericStr === '.' || numericStr === '-') {
        console.warn(`Valeur non numérique pour un champ integer: "${trimmedValue}", utilisation de null`);
        return null;
      }
      
      const numberValue = parseFloat(numericStr);
      if (isNaN(numberValue) || !isFinite(numberValue)) {
        console.warn(`Valeur non numérique pour un champ integer: "${trimmedValue}", utilisation de null`);
        return null;
      }
      
      // Check if it's within PostgreSQL integer range
      const intValue = Math.floor(numberValue);
      if (intValue < -2147483648 || intValue > 2147483647) {
        console.warn(`Valeur entière hors limites: ${intValue}, utilisation de null`);
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
      // Pour les valeurs non booléennes, retourner null au lieu d'erreur
      console.warn(`Valeur non booléenne pour un champ boolean: "${trimmedValue}", utilisation de null`);
      return null;
      
    case "date":
      try {
        return parseContactDate(trimmedValue);
      } catch (error) {
        console.warn(`Erreur de parsing de date: "${trimmedValue}", utilisation de null`);
        return null;
      }
      
    case "datetime":
      try {
        return parseContactDateTime(trimmedValue);
      } catch (error) {
        console.warn(`Erreur de parsing de datetime: "${trimmedValue}", utilisation de null`);
        return null;
      }
      
    default:
      // Ensure default string values don't cause serialization issues
      return trimmedValue.substring(0, 500);
  }
}

function parseContactDate(dateStr: string): string | null {
  // Support de multiples formats de date - sortie format YYYY/MM/DD
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{4})-(d{1,2})-(d{1,2})$/, // YYYY-MM-DD
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let [, part1, part2, part3] = match;
      
      // Pour le format DD/MM/YYYY (européen)
      if (format === formats[0] && parseInt(part1) <= 12 && parseInt(part2) > 12) {
        // Si la première partie est <= 12 et la seconde > 12, assumer DD/MM/YYYY
        return `${part3}/${part2.padStart(2, '0')}/${part1.padStart(2, '0')}`;
      } else if (format === formats[0]) {
        // Sinon assumer MM/DD/YYYY
        return `${part3}/${part1.padStart(2, '0')}/${part2.padStart(2, '0')}`;
      } else if (format === formats[1]) {
        // YYYY-MM-DD -> YYYY/MM/DD
        return `${part1}/${part2.padStart(2, '0')}/${part3.padStart(2, '0')}`;
      } else if (format === formats[2]) {
        // DD-MM-YYYY -> YYYY/MM/DD
        return `${part3}/${part2.padStart(2, '0')}/${part1.padStart(2, '0')}`;
      } else if (format === formats[3]) {
        // YYYY/MM/DD (déjà correct)
        return `${part1}/${part2.padStart(2, '0')}/${part3.padStart(2, '0')}`;
      }
    }
  }
  
  throw new Error(`Format de date non supporté: ${dateStr}`);
}

function parseContactDateTime(dateTimeStr: string): string | null {
  // Tenter de parser comme date d'abord
  try {
    const dateOnly = parseContactDate(dateTimeStr.split(' ')[0]);
    if (dateOnly) {
      // S'il y a une composante temps, l'ajouter
      const timePart = dateTimeStr.split(' ')[1];
      if (timePart) {
        return `${dateOnly} ${timePart}`;
      }
    } else {
      return `${dateOnly} 00:00:00`;
    }
  } catch {
    // Revenir à la conversion directe
  }
  
  // Tenter le format ISO
  const isoDate = new Date(dateTimeStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }
  
  throw new Error(`Format de datetime non supporté: ${dateTimeStr}`);
}

function generateHexacleHash(row: any): string {
  // Concaténation: adresse + ville + code_postal
  const components = [
    row.adresse || '',
    row.ville || '',
    row.code_postal || ''
  ];
  
  return components
    .filter(component => component.trim() !== '')
    .map(component => component.trim().toUpperCase().replace(/[\s\-\.]/g, ''))
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
      const sanitized = value.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
    const sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
      // Valider et nettoyer les données avant insertion
      const cleanedRow = validateAndCleanRowData(row);
      
      await db.exec`
        INSERT INTO contacts (
          civilite, prenom, nom, date_naissance, age, profession,
          adresse, adresse_complement, code_postal, ville, departement,
          email, mobile, phone,
          nb_enfants, enfant1_date_naissance, enfant2_date_naissance, enfant3_date_naissance,
          hexacle_hash
        )
        VALUES (
          ${cleanedRow.civilite}, ${cleanedRow.prenom}, ${cleanedRow.nom}, ${cleanedRow.date_naissance}, 
          ${cleanedRow.age}, ${cleanedRow.profession},
          ${cleanedRow.adresse}, ${cleanedRow.adresse_complement}, ${cleanedRow.code_postal}, 
          ${cleanedRow.ville}, ${cleanedRow.departement},
          ${cleanedRow.email}, ${cleanedRow.mobile}, ${cleanedRow.phone}, 
          ${cleanedRow.nb_enfants}, ${cleanedRow.enfant1_date_naissance}, ${cleanedRow.enfant2_date_naissance}, 
          ${cleanedRow.enfant3_date_naissance}, ${cleanedRow.hexacle_hash}
        )
      `;
    } catch (e: any) {
      errors.push(`Ligne ${i + 1}: ${e.message}`);
    }
  }
  
  return errors;
}

// Fonction legacy pour l'ancien endpoint
async function insertContactBatch(batch: any[]) {
  if (batch.length === 0) return;

  for (const row of batch) {
    try {
      // Générer le hexacle_hash pour l'ancien endpoint aussi
      if (!row.hexacle_hash) {
        const hashValue = generateHexacleHash(row);
        row.hexacle_hash = hashValue;
      }
      
      // Valider et nettoyer les données
      const cleanedRow = validateAndCleanRowData(row);
      
      await db.exec`
        INSERT INTO contacts (
          civilite, prenom, nom, date_naissance, age, profession,
          adresse, adresse_complement, code_postal, ville, departement,
          email, mobile, phone,
          nb_enfants, enfant1_date_naissance, enfant2_date_naissance, enfant3_date_naissance,
          hexacle_hash
        )
        VALUES (
          ${cleanedRow.civilite}, ${cleanedRow.prenom}, ${cleanedRow.nom}, ${cleanedRow.date_naissance}, 
          ${cleanedRow.age}, ${cleanedRow.profession},
          ${cleanedRow.adresse}, ${cleanedRow.adresse_complement}, ${cleanedRow.code_postal}, 
          ${cleanedRow.ville}, ${cleanedRow.departement},
          ${cleanedRow.email}, ${cleanedRow.mobile}, ${cleanedRow.phone}, 
          ${cleanedRow.nb_enfants}, ${cleanedRow.enfant1_date_naissance}, ${cleanedRow.enfant2_date_naissance}, 
          ${cleanedRow.enfant3_date_naissance}, ${cleanedRow.hexacle_hash}
        )
      `;
    } catch (e: any) {
      console.error(`Failed to insert row: ${JSON.stringify(row)}`, e.message);
    }
  }
}

export const getContactsCount = api<void, { count: number }>(
  { expose: true, method: "GET", path: "/settings/contacts/count" },
  async (): Promise<{ count: number }> => {
    const result = await db.queryRow`SELECT count(*) as count FROM contacts`;
    const count = (result as { count: number } | undefined)?.count;
    return { count: Number(count) || 0 };
  }
);