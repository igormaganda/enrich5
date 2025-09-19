import { api } from "encore.dev/api";
import csv from "csv-parser";
import { Readable } from "stream";

export interface ContactCSVAnalysisRequest {
  csvContent: string;
  delimiter?: string;
  showOnlySupportedFields?: boolean; // Toggle pour afficher seulement les champs pris en charge
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

// Schema EXACT avec les noms de colonnes de la base de données
const CONTACT_DATABASE_COLUMNS: ContactDatabaseColumn[] = [
  // Identité personnelle
  { name: "civilite", type: "string", required: false, description: "Civilité" },
  { name: "nom", type: "string", required: false, description: "Nom de famille" },
  { name: "prenom", type: "string", required: false, description: "Prénom" },
  { name: "date_naissance", type: "date", required: false, description: "Date de naissance (AAAA/MM/JJ)" },
  { name: "age", type: "integer", required: false, description: "Âge" },
  { name: "profession", type: "string", required: false, description: "Profession" },
  
  // Adresse personnelle
  { name: "adresse", type: "string", required: false, description: "Adresse" },
  { name: "adresse_complement", type: "string", required: false, description: "Complément d'adresse" },
  { name: "code_postal", type: "string", required: false, description: "Code postal" },
  { name: "ville", type: "string", required: false, description: "Ville" },
  { name: "departement", type: "string", required: false, description: "Département" },
  
  // Informations personnelles basiques
  { name: "email", type: "string", required: false, description: "Adresse email" },
  { name: "mobile", type: "string", required: false, description: "Téléphone mobile" },
  { name: "phone", type: "string", required: false, description: "Téléphone fixe" },
  
  // Famille
  { name: "nb_enfants", type: "integer", required: false, description: "Nombre d'enfants" },
  { name: "enfant1_date_naissance", type: "date", required: false, description: "Date naissance enfant 1 (AAAA/MM/JJ)" },
  { name: "enfant2_date_naissance", type: "date", required: false, description: "Date naissance enfant 2 (AAAA/MM/JJ)" },
  { name: "enfant3_date_naissance", type: "date", required: false, description: "Date naissance enfant 3 (AAAA/MM/JJ)" }
];

// Mapping EXACT pour correspondance automatique 100%
const CONTACT_HEADER_MAPPINGS: Record<string, string[]> = {
  // Identité personnelle - noms EXACTS
  "civilite": ["civilite"],
  "nom": ["nom"],  
  "prenom": ["prenom"],
  "date_naissance": ["date_naissance"],
  "age": ["age"],
  "profession": ["profession"],
  
  // Adresse personnelle - noms EXACTS
  "adresse": ["adresse"],
  "adresse_complement": ["adresse_complement"],
  "code_postal": ["code_postal"],
  "ville": ["ville"],
  "departement": ["departement"],
  
  // Informations basiques - noms EXACTS
  "email": ["email"],
  "mobile": ["mobile"],
  "phone": ["phone"],
  
  // Famille - noms EXACTS
  "nb_enfants": ["nb_enfants"],
  "enfant1_date_naissance": ["enfant1_date_naissance"],
  "enfant2_date_naissance": ["enfant2_date_naissance"],
  "enfant3_date_naissance": ["enfant3_date_naissance"]
};

export const analyzeContactCSV = api<ContactCSVAnalysisRequest, ContactCSVAnalysisResponse>(
  { expose: true, method: "POST", path: "/settings/contacts/analyze-csv" },
  async ({ csvContent, delimiter = ",", showOnlySupportedFields = false }) => {
    // Parser CSV pour extraire les headers
    const csvHeaders = await extractContactCSVHeaders(csvContent, delimiter);
    
    // Générer les suggestions de mapping
    const suggestedMappings = generateContactMappingSuggestions(csvHeaders, showOnlySupportedFields);
    
    return {
      csvHeaders: showOnlySupportedFields ? csvHeaders.filter(header => 
        suggestedMappings.some(mapping => mapping.csvHeader === header && mapping.matched)
      ) : csvHeaders,
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

function generateContactMappingSuggestions(csvHeaders: string[], showOnlySupportedFields: boolean = false): ContactColumnMapping[] {
  const mappings: ContactColumnMapping[] = [];
  
  for (const csvHeader of csvHeaders) {
    const normalizedHeader = csvHeader.toLowerCase().trim();
    let suggestedColumn = "";
    let dataType = "string";
    let matched = false;
    
    // Chercher correspondance EXACTE d'abord
    for (const [dbColumn, patterns] of Object.entries(CONTACT_HEADER_MAPPINGS)) {
      if (patterns.includes(normalizedHeader)) {
        suggestedColumn = dbColumn;
        matched = true;
        const dbCol = CONTACT_DATABASE_COLUMNS.find(col => col.name === dbColumn);
        if (dbCol) {
          dataType = dbCol.type;
        }
        break;
      }
    }
    
    // Si showOnlySupportedFields = true, ne garder que les champs avec correspondance
    if (showOnlySupportedFields && !matched) {
      continue;
    }
    
    mappings.push({
      csvHeader,
      dbColumn: suggestedColumn || null,
      dataType,
      required: false,
      matched
    });
  }
  
  return mappings;
}