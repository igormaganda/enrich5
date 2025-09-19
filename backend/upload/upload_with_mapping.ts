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
      return trimmedValue;
      
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
  // Concatenation: numéro de rue + adresse + ville + code postal
  const components = [
    row.address || '',
    row.city || '',
    row.postal_code || ''
  ];
  
  return components
    .filter(component => component.trim() !== '')
    .map(component => component.trim().toUpperCase())
    .join('');
}

function validateAndCleanRowData(row: any): any {
  const cleaned: any = {};
  
  // Helper function to validate and clean each field
  const cleanField = (fieldName: string, value: any, validator?: (val: any) => any) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    
    if (validator) {
      try {
        return validator(value);
      } catch (error) {
        console.warn(`Validation failed for ${fieldName}: ${value}, using null`);
        return null;
      }
    }
    
    // Default string truncation for VARCHAR fields to prevent overflow
    if (typeof value === 'string' && value.length > 255) {
      console.warn(`Truncating ${fieldName} from ${value.length} to 255 characters`);
      return value.substring(0, 255);
    }
    
    return value;
  };
  
  // Validate and clean each field
  cleaned.email = cleanField('email', row.email);
  cleaned.mobile_phone = cleanField('mobile_phone', row.mobile_phone);
  cleaned.landline_phone = cleanField('landline_phone', row.landline_phone);
  cleaned.civility = cleanField('civility', row.civility);
  cleaned.last_name = cleanField('last_name', row.last_name);
  cleaned.first_name = cleanField('first_name', row.first_name);
  cleaned.address = cleanField('address', row.address);
  cleaned.address_complement = cleanField('address_complement', row.address_complement);
  cleaned.postal_code = cleanField('postal_code', row.postal_code);
  cleaned.city = cleanField('city', row.city);
  
  // Special validation for department (parameter 11) - ensure no overflow
  cleaned.department = cleanField('department', row.department, (val) => {
    if (val === undefined || val === null || val === '') {
      return null;
    }
    const str = String(val).trim();
    // Truncate to 255 characters to prevent PostgreSQL VARCHAR(255) overflow
    if (str.length > 255) {
      return str.substring(0, 255);
    }
    return str;
  });
  
  cleaned.date_of_birth = cleanField('date_of_birth', row.date_of_birth);
  
  // Special validation for age (parameter 13) - ensure PostgreSQL INTEGER range
  cleaned.age = cleanField('age', row.age, (val) => {
    if (val === undefined || val === null || val === '') {
      return null;
    }
    const numVal = Number(val);
    if (isNaN(numVal)) {
      return null;
    }
    const intVal = Math.floor(numVal);
    // PostgreSQL INTEGER range: -2,147,483,648 to 2,147,483,647
    // But for age, we use reasonable bounds
    if (intVal < 0 || intVal > 150 || intVal > 2147483647 || intVal < -2147483648) {
      return null;
    }
    return intVal;
  });
  
  cleaned.date_optin = cleanField('date_optin', row.date_optin);
  cleaned.optin_sms = cleanField('optin_sms', row.optin_sms);
  cleaned.optout_url = cleanField('optout_url', row.optout_url);
  cleaned.optout_contact = cleanField('optout_contact', row.optout_contact);
  cleaned.email_quality = cleanField('email_quality', row.email_quality);
  cleaned.address_quality = cleanField('address_quality', row.address_quality);
  cleaned.housing_status = cleanField('housing_status', row.housing_status);
  cleaned.housing_type = cleanField('housing_type', row.housing_type);
  cleaned.children_family = cleanField('children_family', row.children_family);
  cleaned.profession = cleanField('profession', row.profession);
  cleaned.ip_collect = cleanField('ip_collect', row.ip_collect);
  cleaned.collect_url = cleanField('collect_url', row.collect_url);
  cleaned.score_bloctel = cleanField('score_bloctel', row.score_bloctel);
  cleaned.iris = cleanField('iris', row.iris);
  cleaned.urban_unit = cleanField('urban_unit', row.urban_unit);
  cleaned.municipality_type = cleanField('municipality_type', row.municipality_type);
  cleaned.moving = cleanField('moving', row.moving);
  cleaned.robinson = cleanField('robinson', row.robinson);
  cleaned.last_active_date = cleanField('last_active_date', row.last_active_date);
  cleaned.last_click_date = cleanField('last_click_date', row.last_click_date);
  cleaned.interests = cleanField('interests', row.interests);
  cleaned.email_md5 = cleanField('email_md5', row.email_md5);
  cleaned.email_sha256 = cleanField('email_sha256', row.email_sha256);
  cleaned.mobile_md5 = cleanField('mobile_md5', row.mobile_md5);
  cleaned.mobile_clean = cleanField('mobile_clean', row.mobile_clean);
  cleaned.region = cleanField('region', row.region);
  cleaned.date_optin_sms = cleanField('date_optin_sms', row.date_optin_sms);
  
  // Validation for children_count
  cleaned.children_count = cleanField('children_count', row.children_count, (val) => {
    const numVal = Number(val);
    if (isNaN(numVal)) return null;
    const intVal = Math.floor(numVal);
    return (intVal >= 0 && intVal <= 20) ? intVal : null;
  });
  
  cleaned.child1_birth_date = cleanField('child1_birth_date', row.child1_birth_date);
  cleaned.child2_birth_date = cleanField('child2_birth_date', row.child2_birth_date);
  cleaned.child3_birth_date = cleanField('child3_birth_date', row.child3_birth_date);
  cleaned.income = cleanField('income', row.income);
  cleaned.second_home = cleanField('second_home', row.second_home);
  cleaned.pet_owner = cleanField('pet_owner', row.pet_owner);
  cleaned.pet_type = cleanField('pet_type', row.pet_type);
  cleaned.hexacle = cleanField('hexacle', row.hexacle);
  cleaned.mobile_sha256 = cleanField('mobile_sha256', row.mobile_sha256);
  cleaned.landline_md5 = cleanField('landline_md5', row.landline_md5);
  cleaned.landline_sha256 = cleanField('landline_sha256', row.landline_sha256);
  cleaned.optin_email = cleanField('optin_email', row.optin_email);
  cleaned.hexavia = cleanField('hexavia', row.hexavia);
  cleaned.roudis = cleanField('roudis', row.roudis);
  cleaned.last_consent_date = cleanField('last_consent_date', row.last_consent_date);
  cleaned.best_date = cleanField('best_date', row.best_date);
  cleaned.score_email = cleanField('score_email', row.score_email);
  cleaned.score_usage = cleanField('score_usage', row.score_usage);
  cleaned.optin_tmk = cleanField('optin_tmk', row.optin_tmk);
  cleaned.optin_postal = cleanField('optin_postal', row.optin_postal);
  cleaned.source_files = cleanField('source_files', row.source_files);
  cleaned.best_priority = cleanField('best_priority', row.best_priority);
  cleaned.hexacle_hash = cleanField('hexacle_hash', row.hexacle_hash);
  
  return cleaned;
}

async function insertContactBatchWithMapping(batch: any[]): Promise<string[]> {
  const errors: string[] = [];
  
  if (batch.length === 0) return errors;

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      // Data is already processed by mapRowToDatabase, no need for additional cleaning
      const cleanedRow = row;
      
      await db.exec`
        INSERT INTO contacts (
          email, mobile_phone, landline_phone, civility, last_name, first_name, address, 
          address_complement, postal_code, city, department, date_of_birth, age, date_optin, 
          optin_sms, optout_url, optout_contact, email_quality, address_quality, housing_status, 
          housing_type, children_family, profession, ip_collect, collect_url, score_bloctel, 
          iris, urban_unit, municipality_type, moving, robinson, last_active_date, 
          last_click_date, interests, email_md5, email_sha256, mobile_md5, mobile_clean, 
          region, date_optin_sms, children_count, child1_birth_date, child2_birth_date, 
          child3_birth_date, income, second_home, pet_owner, pet_type, hexacle, mobile_sha256, 
          landline_md5, landline_sha256, optin_email, hexavia, roudis, last_consent_date, 
          best_date, score_email, score_usage, optin_tmk, optin_postal, source_files, best_priority, hexacle_hash
        )
        VALUES (
          ${cleanedRow.email}, ${cleanedRow.mobile_phone}, ${cleanedRow.landline_phone}, 
          ${cleanedRow.civility}, ${cleanedRow.last_name}, ${cleanedRow.first_name}, 
          ${cleanedRow.address}, ${cleanedRow.address_complement}, ${cleanedRow.postal_code}, 
          ${cleanedRow.city}, ${cleanedRow.department}, ${cleanedRow.date_of_birth}, 
          ${cleanedRow.age}, ${cleanedRow.date_optin}, ${cleanedRow.optin_sms}, 
          ${cleanedRow.optout_url}, ${cleanedRow.optout_contact}, ${cleanedRow.email_quality}, 
          ${cleanedRow.address_quality}, ${cleanedRow.housing_status}, ${cleanedRow.housing_type}, 
          ${cleanedRow.children_family}, ${cleanedRow.profession}, ${cleanedRow.ip_collect}, 
          ${cleanedRow.collect_url}, ${cleanedRow.score_bloctel}, ${cleanedRow.iris}, 
          ${cleanedRow.urban_unit}, ${cleanedRow.municipality_type}, ${cleanedRow.moving}, 
          ${cleanedRow.robinson}, ${cleanedRow.last_active_date}, ${cleanedRow.last_click_date}, 
          ${cleanedRow.interests}, ${cleanedRow.email_md5}, ${cleanedRow.email_sha256}, 
          ${cleanedRow.mobile_md5}, ${cleanedRow.mobile_clean}, ${cleanedRow.region}, 
          ${cleanedRow.date_optin_sms}, ${cleanedRow.children_count}, ${cleanedRow.child1_birth_date}, 
          ${cleanedRow.child2_birth_date}, ${cleanedRow.child3_birth_date}, ${cleanedRow.income}, 
          ${cleanedRow.second_home}, ${cleanedRow.pet_owner}, ${cleanedRow.pet_type}, 
          ${cleanedRow.hexacle}, ${cleanedRow.mobile_sha256}, ${cleanedRow.landline_md5}, 
          ${cleanedRow.landline_sha256}, ${cleanedRow.optin_email}, ${cleanedRow.hexavia}, 
          ${cleanedRow.roudis}, ${cleanedRow.last_consent_date}, ${cleanedRow.best_date}, 
          ${cleanedRow.score_email}, ${cleanedRow.score_usage}, ${cleanedRow.optin_tmk}, 
          ${cleanedRow.optin_postal}, ${cleanedRow.source_files}, ${cleanedRow.best_priority}, ${cleanedRow.hexacle_hash}
        )
      `;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }
  
  return errors;
}