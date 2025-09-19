import { api } from "encore.dev/api";
import csv from "csv-parser";
import { Readable } from "stream";
import { v4 as uuidv4 } from 'uuid';
import type { ContactColumnMapping } from "./contact_mapping";
import db from "../db";

// ========== INTERFACES ========== 

export interface UploadContactsWithMappingRequest {
  csvContent: string;
  columnMappings: ContactColumnMapping[];
  delimiter?: string;
}

export interface UploadContactsResponse {
  jobId: string;
}

// ========== API ENDPOINTS ========== 

// Lance l'upload en tâche de fond et retourne un Job ID
export const uploadContactsWithMapping = api<UploadContactsWithMappingRequest, UploadContactsResponse>(
  { expose: true, method: "POST", path: "/settings/contacts/upload-with-mapping", bodyLimit: null },
  async ({ csvContent, columnMappings, delimiter = "," }) => {
    const jobId = uuidv4();
    // On compte les lignes (-1 pour l'en-tête) pour la barre de progression
    const totalRows = csvContent.split(/\r\n|\r|\n/).length - 1;

    await db.exec`
      INSERT INTO job_history (job_id, filename, status, file_type, total_records, created_by)
      VALUES (${jobId}, 'contact_upload.csv', 'processing', 'contact', ${totalRows}, 'user')
    `;

    // Lance le traitement en arrière-plan sans attendre (fire-and-forget)
    processContactUploadInBackground(jobId, csvContent, columnMappings, delimiter);

    return { jobId };
  }
);

export const getContactsCount = api<void, { count: number }>(
  { expose: true, method: "GET", path: "/settings/contacts/count" },
  async (): Promise<{ count: number }> => {
    const result = await db.queryRow`SELECT count(*) as count FROM contacts`;
    const count = (result as { count: number } | undefined)?.count;
    return { count: Number(count) || 0 };
  }
);

// ========== LOGIQUE DE TRAITEMENT ========== 

async function processContactUploadInBackground(
  jobId: string, 
  csvContent: string, 
  columnMappings: ContactColumnMapping[], 
  delimiter: string
) {
  const readable = Readable.from(csvContent);
  const parser = readable.pipe(csv({ separator: delimiter }));

  const batchSize = 100;
  let batch: any[] = [];
  const errors: string[] = [];

  const mappingLookup = new Map<string, ContactColumnMapping>();
  columnMappings.forEach(m => m.dbColumn && mappingLookup.set(m.csvHeader, m));

  let rowCount = 0;
  for await (const row of parser) {
    rowCount++;
    try {
      const mappedRow = mapRowToDatabase(row, mappingLookup);
      if (mappedRow) {
        batch.push(mappedRow);
      }
    } catch (error: any) {
      errors.push(`Ligne ${rowCount}: ${error.message}`);
    }

    if (batch.length >= batchSize) {
      const batchErrors = await insertContactBatch(batch);
      errors.push(...batchErrors.map(e => `Lignes ${rowCount - batch.length + 1}-${rowCount}: ${e}`));
      await db.exec`UPDATE job_history SET records_processed = records_processed + ${batch.length} WHERE job_id = ${jobId}`;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const batchErrors = await insertContactBatch(batch);
    errors.push(...batchErrors.map(e => `Lignes ${rowCount - batch.length + 1}-${rowCount}: ${e}`));
    await db.exec`UPDATE job_history SET records_processed = records_processed + ${batch.length} WHERE job_id = ${jobId}`;
  }

  const finalStatus = errors.length > 0 ? 'completed_with_errors' : 'completed';
  await db.exec`
    UPDATE job_history 
    SET status = ${finalStatus}, completed_at = NOW(), error_message = ${errors.join('\n')}
    WHERE job_id = ${jobId}
  `;
}

function mapRowToDatabase(csvRow: any, mappingLookup: Map<string, ContactColumnMapping>): any | null {
  const dbRow: any = {};
  let hasData = false;
  for (const [csvHeader, value] of Object.entries(csvRow)) {
    const mapping = mappingLookup.get(csvHeader);
    if (mapping && mapping.dbColumn && value != null && String(value).trim() !== '') {
      dbRow[mapping.dbColumn] = String(value).trim();
      hasData = true;
    }
  }

  if (hasData) {
    dbRow.hexacle = dbRow.hexacle || generateHexacle(dbRow);
    return dbRow;
  }
  return null;
}

function generateHexacle(row: any): string {
  const components = [row.nom, row.prenom, row.adresse, row.code_postal, row.ville];
  return components.map(c => String(c || '').trim().toUpperCase()).join('|');
}

async function insertContactBatch(batch: any[]): Promise<string[]> {
  if (batch.length === 0) return [];
  const errors: string[] = [];

  // On ne peut pas utiliser `db.exec` avec un array pour des requêtes multiples,
  // donc on itère sur chaque ligne pour l'instant.
  // Pour la production, il faudrait une librairie comme `pg-promise` pour des inserts en masse.
  for (const row of batch) {
    try {
      await db.exec`
        INSERT INTO contacts (
          id_source, email, mobile, phone, civilite, nom, prenom, adresse, adresse_complement, code_postal, ville, departement, date_naissance, age, date_optin, optin_sms, optout_url, optout_contact, email_quality, adresse_quality, habitation_statut, habitation_type, famille_enfants, profession, ip_collecte, collect_url, score_bloctel, iris, urban_unit, municipality_type, demenage, robinson, date_last_active, date_last_click, centre_interet, email_md5, email_sha256, mobile_md5, mobile_clean, region, date_optin_sms, nb_enfants, enfant1_date_naissance, enfant2_date_naissance, enfant3_date_naissance, revenu, second_home, pet_owner, pet_type, hexacle, mobile_sha256, land_phone_md5, land_phone_sha256, optin_email, hexavia, roudis, date_last_consent, date_best, score_email, score_usage, optin_tmk, optin_postal, source_files, best_priority
        )
        VALUES (
          ${row.id_source || null}, ${row.email || null}, ${row.mobile || null}, ${row.phone || null}, ${row.civilite || null}, ${row.nom || null}, ${row.prenom || null}, ${row.adresse || null}, ${row.adresse_complement || null}, ${row.code_postal || null}, ${row.ville || null}, ${row.departement || null}, ${row.date_naissance || null}, ${row.age || null}, ${row.date_optin || null}, ${row.optin_sms || null}, ${row.optout_url || null}, ${row.optout_contact || null}, ${row.email_quality || null}, ${row.adresse_quality || null}, ${row.habitation_statut || null}, ${row.habitation_type || null}, ${row.famille_enfants || null}, ${row.profession || null}, ${row.ip_collecte || null}, ${row.collect_url || null}, ${row.score_bloctel || null}, ${row.iris || null}, ${row.urban_unit || null}, ${row.municipality_type || null}, ${row.demenage || null}, ${row.robinson || null}, ${row.date_last_active || null}, ${row.date_last_click || null}, ${row.centre_interet || null}, ${row.email_md5 || null}, ${row.email_sha256 || null}, ${row.mobile_md5 || null}, ${row.mobile_clean || null}, ${row.region || null}, ${row.date_optin_sms || null}, ${row.nb_enfants || null}, ${row.enfant1_date_naissance || null}, ${row.enfant2_date_naissance || null}, ${row.enfant3_date_naissance || null}, ${row.revenu || null}, ${row.second_home || null}, ${row.pet_owner || null}, ${row.pet_type || null}, ${row.hexacle || null}, ${row.mobile_sha256 || null}, ${row.land_phone_md5 || null}, ${row.land_phone_sha256 || null}, ${row.optin_email || null}, ${row.hexavia || null}, ${row.roudis || null}, ${row.date_last_consent || null}, ${row.date_best || null}, ${row.score_email || null}, ${row.score_usage || null}, ${row.optin_tmk || null}, ${row.optin_postal || null}, ${row.source_files || null}, ${row.best_priority || null}
        )
        ON CONFLICT (hexacle) DO UPDATE SET
          id_source = COALESCE(EXCLUDED.id_source, contacts.id_source),
          email = COALESCE(EXCLUDED.email, contacts.email),
          mobile = COALESCE(EXCLUDED.mobile, contacts.mobile),
          phone = COALESCE(EXCLUDED.phone, contacts.phone),
          civilite = COALESCE(EXCLUDED.civilite, contacts.civilite),
          nom = COALESCE(EXCLUDED.nom, contacts.nom),
          prenom = COALESCE(EXCLUDED.prenom, contacts.prenom),
          adresse = COALESCE(EXCLUDED.adresse, contacts.adresse),
          adresse_complement = COALESCE(EXCLUDED.adresse_complement, contacts.adresse_complement),
          code_postal = COALESCE(EXCLUDED.code_postal, contacts.code_postal),
          ville = COALESCE(EXCLUDED.ville, contacts.ville),
          departement = COALESCE(EXCLUDED.departement, contacts.departement),
          date_naissance = EXCLUDED.date_naissance,
          age = EXCLUDED.age,
          date_optin = EXCLUDED.date_optin,
          updated_at = NOW();
      `;
    } catch (e: any) {
      errors.push(e.message);
    }
  }
  return errors;
}