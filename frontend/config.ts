// Configuration du pipeline d'enrichissement
export const config = {
  // Configuration Cloudflare R2
  // Remplir avec les identifiants de votre bucket R2
  r2: {
    accessKeyId: "", // À remplir avec votre R2 Access Key ID
    secretAccessKey: "", // À remplir avec votre R2 Secret Access Key
    endpoint: "", // À remplir avec votre R2 endpoint (ex: https://account-id.r2.cloudflarestorage.com)
    bucketName: "", // À remplir avec le nom de votre bucket R2
    region: "auto", // Généralement 'auto' pour R2
  },

  // Configuration SMTP pour les emails
  // Remplir avec les paramètres de votre serveur SMTP
  smtp: {
    host: "smtp.gmail.com", // À remplir avec l'hôte SMTP (ex: smtp.gmail.com)
    port: 465, // Port SMTP (généralement 587 pour TLS)
    secure: true, // true pour 465, false pour autres ports
    auth: {
      user: "hackersranch@gmail.com", // À remplir avec votre email/nom d'utilisateur SMTP
      pass: "wftu sloa kpsq wecy", // À remplir avec votre mot de passe SMTP
    },
  },

  // Configuration de l'application
  app: {
    name: "Pipeline d'Enrichissement",
    maxFileSize: 100 * 1024 * 1024, // 100MB max par fichier
    allowedFileTypes: [".zip"], // Types de fichiers autorisés
    downloadLinkExpiry: 24 * 60 * 60 * 1000, // 24h en millisecondes
  },

  // Configuration du traitement
  processing: {
    chunkSize: 1000000, // Traitement par chunks de 1M lignes
    maxConcurrentJobs: 3, // Nombre max de jobs en parallèle
    tempDirectory: "/tmp/enrichissement", // Répertoire temporaire
  },
};

export type Config = typeof config;
