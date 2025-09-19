import { api } from "encore.dev/api";
import csv from "csv-parser";
import { Readable } from "stream";

export interface CSVAnalysisRequest {
  csvContent: string;
  delimiter?: string;
}

export interface ColumnMapping {
  csvHeader: string;
  dbColumn: string;
  dataType: string;
  required: boolean;
}

export interface CSVAnalysisResponse {
  csvHeaders: string[];
  suggestedMappings: ColumnMapping[];
  dbColumns: DatabaseColumn[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

// Database schema for contacts table
const DATABASE_COLUMNS: DatabaseColumn[] = [
  {
    name: "email",
    type: "string",
    required: false,
    description: "Email address",
  },
  {
    name: "mobile_phone",
    type: "string",
    required: false,
    description: "Mobile phone number",
  },
  {
    name: "landline_phone",
    type: "string",
    required: false,
    description: "Landline phone number",
  },
  {
    name: "civility",
    type: "string",
    required: false,
    description: "Civility (Mr, Mrs, etc.)",
  },
  {
    name: "last_name",
    type: "string",
    required: false,
    description: "Last name",
  },
  {
    name: "first_name",
    type: "string",
    required: false,
    description: "First name",
  },
  {
    name: "address",
    type: "string",
    required: false,
    description: "Street address",
  },
  {
    name: "address_complement",
    type: "string",
    required: false,
    description: "Address complement",
  },
  {
    name: "postal_code",
    type: "string",
    required: false,
    description: "Postal code",
  },
  { name: "city", type: "string", required: false, description: "City" },
  {
    name: "department",
    type: "string",
    required: false,
    description: "Department",
  },
  {
    name: "date_of_birth",
    type: "date",
    required: false,
    description: "Date of birth",
  },
  {
    name: "age",
    type: "integer",
    required: false,
    description: "Age in years",
  },
  {
    name: "date_optin",
    type: "datetime",
    required: false,
    description: "Opt-in date",
  },
  {
    name: "optin_sms",
    type: "boolean",
    required: false,
    description: "SMS opt-in",
  },
  {
    name: "optout_url",
    type: "string",
    required: false,
    description: "Opt-out URL",
  },
  {
    name: "optout_contact",
    type: "string",
    required: false,
    description: "Opt-out contact",
  },
  {
    name: "email_quality",
    type: "string",
    required: false,
    description: "Email quality score",
  },
  {
    name: "address_quality",
    type: "string",
    required: false,
    description: "Address quality score",
  },
  {
    name: "housing_status",
    type: "string",
    required: false,
    description: "Housing status",
  },
  {
    name: "housing_type",
    type: "string",
    required: false,
    description: "Housing type",
  },
  {
    name: "children_family",
    type: "string",
    required: false,
    description: "Family children info",
  },
  {
    name: "profession",
    type: "string",
    required: false,
    description: "Profession",
  },
  {
    name: "ip_collect",
    type: "string",
    required: false,
    description: "Collection IP",
  },
  {
    name: "collect_url",
    type: "string",
    required: false,
    description: "Collection URL",
  },
  {
    name: "score_bloctel",
    type: "string",
    required: false,
    description: "Bloctel score",
  },
  { name: "iris", type: "string", required: false, description: "IRIS code" },
  {
    name: "urban_unit",
    type: "string",
    required: false,
    description: "Urban unit",
  },
  {
    name: "municipality_type",
    type: "string",
    required: false,
    description: "Municipality type",
  },
  {
    name: "moving",
    type: "boolean",
    required: false,
    description: "Moving indicator",
  },
  {
    name: "robinson",
    type: "boolean",
    required: false,
    description: "Robinson list",
  },
  {
    name: "last_active_date",
    type: "datetime",
    required: false,
    description: "Last active date",
  },
  {
    name: "last_click_date",
    type: "datetime",
    required: false,
    description: "Last click date",
  },
  {
    name: "interests",
    type: "string",
    required: false,
    description: "Interests",
  },
  {
    name: "email_md5",
    type: "string",
    required: false,
    description: "Email MD5 hash",
  },
  {
    name: "email_sha256",
    type: "string",
    required: false,
    description: "Email SHA256 hash",
  },
  {
    name: "mobile_md5",
    type: "string",
    required: false,
    description: "Mobile MD5 hash",
  },
  {
    name: "mobile_clean",
    type: "string",
    required: false,
    description: "Clean mobile number",
  },
  { name: "region", type: "string", required: false, description: "Region" },
  {
    name: "date_optin_sms",
    type: "datetime",
    required: false,
    description: "SMS opt-in date",
  },
  {
    name: "children_count",
    type: "integer",
    required: false,
    description: "Number of children",
  },
  {
    name: "child1_birth_date",
    type: "date",
    required: false,
    description: "First child birth date",
  },
  {
    name: "child2_birth_date",
    type: "date",
    required: false,
    description: "Second child birth date",
  },
  {
    name: "child3_birth_date",
    type: "date",
    required: false,
    description: "Third child birth date",
  },
  {
    name: "income",
    type: "string",
    required: false,
    description: "Income range",
  },
  {
    name: "second_home",
    type: "boolean",
    required: false,
    description: "Second home indicator",
  },
  {
    name: "pet_owner",
    type: "boolean",
    required: false,
    description: "Pet owner indicator",
  },
  {
    name: "pet_type",
    type: "string",
    required: false,
    description: "Pet type",
  },
  {
    name: "hexacle",
    type: "string",
    required: false,
    description: "Hexacle identifier",
  },
  {
    name: "mobile_sha256",
    type: "string",
    required: false,
    description: "Mobile SHA256 hash",
  },
  {
    name: "landline_md5",
    type: "string",
    required: false,
    description: "Landline MD5 hash",
  },
  {
    name: "landline_sha256",
    type: "string",
    required: false,
    description: "Landline SHA256 hash",
  },
  {
    name: "optin_email",
    type: "boolean",
    required: false,
    description: "Email opt-in",
  },
  {
    name: "hexavia",
    type: "string",
    required: false,
    description: "Hexavia identifier",
  },
  {
    name: "roudis",
    type: "string",
    required: false,
    description: "Roudis identifier",
  },
  {
    name: "last_consent_date",
    type: "datetime",
    required: false,
    description: "Last consent date",
  },
  {
    name: "best_date",
    type: "datetime",
    required: false,
    description: "Best contact date",
  },
  {
    name: "score_email",
    type: "string",
    required: false,
    description: "Email score",
  },
  {
    name: "score_usage",
    type: "string",
    required: false,
    description: "Usage score",
  },
  {
    name: "optin_tmk",
    type: "boolean",
    required: false,
    description: "Telemarketing opt-in",
  },
  {
    name: "optin_postal",
    type: "boolean",
    required: false,
    description: "Postal opt-in",
  },
  {
    name: "source_files",
    type: "string",
    required: false,
    description: "Source files",
  },
  {
    name: "best_priority",
    type: "string",
    required: false,
    description: "Best priority",
  },
];

// CSV header mapping patterns
const HEADER_MAPPINGS: Record<string, string[]> = {
  email: ["email", "mail", "e-mail", "adresse_email", "email_address"],
  mobile_phone: [
    "mobile",
    "mobile_phone",
    "telephone_mobile",
    "portable",
    "gsm",
  ],
  landline_phone: ["phone", "telephone", "landline", "fixe", "tel"],
  civility: ["civility", "civilite", "titre", "title", "mr", "mrs"],
  last_name: ["last_name", "nom", "lastname", "surname", "family_name"],
  first_name: ["first_name", "prenom", "firstname", "given_name"],
  address: ["address", "adresse", "street", "rue", "voie"],
  address_complement: [
    "address_complement",
    "adresse_complement",
    "complement",
  ],
  postal_code: ["postal_code", "code_postal", "zip", "zipcode"],
  city: ["city", "ville", "town"],
  department: ["department", "departement", "dept"],
  date_of_birth: ["date_of_birth", "date_naissance", "birthday", "birth_date"],
  age: ["age", "years", "annees"],
  date_optin: ["date_optin", "optin_date", "consent_date"],
  children_count: ["children_count", "nb_enfants", "number_children"],
  hexacle: ["hexacle", "id"],
  region: ["region", "area"],
  income: ["income", "revenu", "salary"],
  profession: ["profession", "job", "work", "metier"],
};

export const analyzeCSV = api<CSVAnalysisRequest, CSVAnalysisResponse>(
  { expose: true, method: "POST", path: "/upload/analyze-csv" },
  async ({ csvContent, delimiter = "," }) => {
    // Parse CSV to get headers
    const csvHeaders = await extractCSVHeaders(csvContent, delimiter);

    // Generate suggested mappings
    const suggestedMappings = generateSuggestedMappings(csvHeaders);

    return {
      csvHeaders,
      suggestedMappings,
      dbColumns: DATABASE_COLUMNS,
    };
  }
);

async function extractCSVHeaders(
  csvContent: string,
  delimiter: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const readable = Readable.from(csvContent);
    const headers: string[] = [];

    readable
      .pipe(csv({ separator: delimiter, headers: false }))
      .on("data", (row: any) => {
        // Take first row as headers
        if (headers.length === 0) {
          headers.push(...Object.values(row).map((v) => String(v)));
        }
      })
      .on("end", () => {
        resolve(headers.map((h) => String(h).trim()));
      })
      .on("error", reject);
  });
}

function generateSuggestedMappings(csvHeaders: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (const csvHeader of csvHeaders) {
    const normalizedHeader = csvHeader.toLowerCase().trim();
    let suggestedColumn = "";
    let dataType = "string";

    // Find best match
    for (const [dbColumn, patterns] of Object.entries(HEADER_MAPPINGS)) {
      if (patterns.some((pattern) => normalizedHeader.includes(pattern))) {
        suggestedColumn = dbColumn;
        const dbCol = DATABASE_COLUMNS.find((col) => col.name === dbColumn);
        if (dbCol) {
          dataType = dbCol.type;
        }
        break;
      }
    }

    mappings.push({
      csvHeader,
      dbColumn: suggestedColumn,
      dataType,
      required: false,
    });
  }

  return mappings;
}
