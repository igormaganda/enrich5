import { api } from "encore.dev/api";
import csv from "csv-parser";
import { Readable } from "stream";

export interface ContactCSVAnalysisRequest {
  csvContent: string;
  delimiter?: string;
}

export interface ContactColumnMapping {
  csvHeader: string;
  dbColumn: string | null;
  dataType: string;
  required: boolean;
  matched: boolean; // Si c'est un mapping automatique
}

export interface ContactCSVAnalysisResponse {
  csvHeaders: string[];
  suggestedMappings: ContactColumnMapping[];
  dbColumns: ContactDatabaseColumn[];
}

export interface ContactDatabaseColumn {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// Schema de la table contacts, aligné sur le header du fichier
const CONTACT_DATABASE_COLUMNS: ContactDatabaseColumn[] = [
  { name: "id_source", type: "string", required: false, description: "Source ID" },
  { name: "email", type: "string", required: false, description: "Adresse email" },
  { name: "mobile", type: "string", required: false, description: "Téléphone mobile" },
  { name: "phone", type: "string", required: false, description: "Téléphone fixe" },
  { name: "civilite", type: "string", required: false, description: "Civilité (M., Mme, etc.)" },
  { name: "nom", type: "string", required: false, description: "Nom de famille" },
  { name: "prenom", type: "string", required: false, description: "Prénom" },
  { name: "adresse", type: "string", required: false, description: "Adresse" },
  { name: "adresse_complement", type: "string", required: false, description: "Complément d'adresse" },
  { name: "code_postal", type: "string", required: false, description: "Code postal" },
  { name: "ville", type: "string", required: false, description: "Ville" },
  { name: "departement", type: "string", required: false, description: "Département" },
  { name: "date_naissance", type: "date", required: false, description: "Date de naissance" },
  { name: "age", type: "integer", required: false, description: "Âge" },
  { name: "date_optin", type: "datetime", required: false, description: "Date d'opt-in" },
  { name: "optin_sms", type: "boolean", required: false, description: "Opt-in SMS" },
  { name: "optout_url", type: "string", required: false, description: "URL opt-out" },
  { name: "optout_contact", type: "string", required: false, description: "Contact opt-out" },
  { name: "email_quality", type: "string", required: false, description: "Qualité email" },
  { name: "adresse_quality", type: "string", required: false, description: "Qualité adresse" },
  { name: "habitation_statut", type: "string", required: false, description: "Statut logement" },
  { name: "habitation_type", type: "string", required: false, description: "Type de logement" },
  { name: "famille_enfants", type: "string", required: false, description: "Famille enfants" },
  { name: "profession", type: "string", required: false, description: "Profession" },
  { name: "ip_collecte", type: "string", required: false, description: "IP de collecte" },
  { name: "collect_url", type: "string", required: false, description: "URL de collecte" },
  { name: "score_bloctel", type: "string", required: false, description: "Score Bloctel" },
  { name: "iris", type: "string", required: false, description: "Code IRIS" },
  { name: "urban_unit", type: "string", required: false, description: "Unité urbaine" },
  { name: "municipality_type", type: "string", required: false, description: "Type de commune" },
  { name: "demenage", type: "boolean", required: false, description: "Déménagement" },
  { name: "robinson", type: "boolean", required: false, description: "Liste Robinson" },
  { name: "date_last_active", type: "datetime", required: false, description: "Dernière activité" },
  { name: "date_last_click", type: "datetime", required: false, description: "Dernier clic" },
  { name: "centre_interet", type: "string", required: false, description: "Centres d'intérêt" },
  { name: "email_md5", type: "string", required: false, description: "Email MD5" },
  { name: "email_sha256", type: "string", required: false, description: "Email SHA256" },
  { name: "mobile_md5", type: "string", required: false, description: "Mobile MD5" },
  { name: "mobile_clean", type: "string", required: false, description: "Mobile nettoyé" },
  { name: "region", type: "string", required: false, description: "Région" },
  { name: "date_optin_sms", type: "datetime", required: false, description: "Date opt-in SMS" },
  { name: "nb_enfants", type: "integer", required: false, description: "Nombre d'enfants" },
  { name: "enfant1_date_naissance", type: "date", required: false, description: "Date naissance enfant 1" },
  { name: "enfant2_date_naissance", type: "date", required: false, description: "Date naissance enfant 2" },
  { name: "enfant3_date_naissance", type: "date", required: false, description: "Date naissance enfant 3" },
  { name: "revenu", type: "string", required: false, description: "Revenu" },
  { name: "second_home", type: "boolean", required: false, description: "Résidence secondaire" },
  { name: "pet_owner", type: "boolean", required: false, description: "Propriétaire animal" },
  { name: "pet_type", type: "string", required: false, description: "Type d'animal" },
  { name: "hexacle", type: "string", required: false, description: "Hexacle identifier" },
  { name: "mobile_sha256", type: "string", required: false, description: "Mobile SHA256" },
  { name: "land_phone_md5", type: "string", required: false, description: "Fixe MD5" },
  { name: "land_phone_sha256", type: "string", required: false, description: "Fixe SHA256" },
  { name: "optin_email", type: "boolean", required: false, description: "Opt-in email" },
  { name: "hexavia", type: "string", required: false, description: "Identifiant Hexavia" },
  { name: "roudis", type: "string", required: false, description: "Identifiant Roudis" },
  { name: "date_last_consent", type: "datetime", required: false, description: "Dernière date de consentement" },
  { name: "date_best", type: "datetime", required: false, description: "Meilleure date" },
  { name: "score_email", type: "string", required: false, description: "Score email" },
  { name: "score_usage", type: "string", required: false, description: "Score d'usage" },
  { name: "optin_tmk", type: "boolean", required: false, description: "Opt-in télémarketing" },
  { name: "optin_postal", type: "boolean", required: false, description: "Opt-in postal" },
  { name: "source_files", type: "string", required: false, description: "Fichiers sources" },
  { name: "best_priority", type: "string", required: false, description: "Meilleure priorité" }
];

export const analyzeContactCSV = api<ContactCSVAnalysisRequest, ContactCSVAnalysisResponse>(
  { expose: true, method: "POST", path: "/settings/contacts/analyze-csv" },
  async ({ csvContent, delimiter = "," }) => {
    // Parser CSV pour extraire les headers
    const csvHeaders = await extractContactCSVHeaders(csvContent, delimiter);
    
    // Générer les suggestions de mapping
    const suggestedMappings = generateContactMappingSuggestions(csvHeaders);
    
    return {
      csvHeaders,
      suggestedMappings,
      dbColumns: CONTACT_DATABASE_COLUMNS
    };
  }
);

async function extractContactCSVHeaders(csvContent: string, delimiter: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const readable = Readable.from(csvContent);
    const headers: string[] = [];
    
    readable
      .pipe(csv({ separator: delimiter, headers: false }))
      .on('data', (row: any) => {
        // Prendre la première ligne comme headers
        if (headers.length === 0) {
          headers.push(...Object.values(row).map(v => String(v).trim()));
        }
      })
      .on('end', () => {
        resolve(headers);
      })
      .on('error', reject);
  });
}

function generateContactMappingSuggestions(csvHeaders: string[]): ContactColumnMapping[] {
  const dbColumnNames = new Set(CONTACT_DATABASE_COLUMNS.map(c => c.name));
  const mappings: ContactColumnMapping[] = [];

  for (const csvHeader of csvHeaders) {
    // Ignorer la colonne 'id' du fichier CSV
    if (csvHeader.toLowerCase() === 'id') {
      continue;
    }

    const normalizedHeader = csvHeader.toLowerCase();
    let suggestedColumn: string | null = null;
    let dataType = "string";
    let matched = false;

    // Correspondance exacte (sensible à la casse après normalisation)
    if (dbColumnNames.has(normalizedHeader)) {
      suggestedColumn = normalizedHeader;
      matched = true;
      const dbCol = CONTACT_DATABASE_COLUMNS.find(col => col.name === suggestedColumn);
      if (dbCol) {
        dataType = dbCol.type;
      }
    }
    
    mappings.push({
      csvHeader,
      dbColumn: suggestedColumn,
      dataType,
      required: false,
      matched
    });
  }
  
  return mappings;
}
