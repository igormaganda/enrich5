CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section, key)
);

CREATE INDEX IF NOT EXISTS idx_app_settings_section ON app_settings(section);

-- Configuration par défaut
INSERT INTO app_settings (section, key, value, value_type, description) VALUES
-- Email Settings
('email', 'smtpHost', 'smtp.gmail.com', 'string', 'Serveur SMTP'),
('email', 'smtpPort', '465', 'number', 'Port SMTP'),
('email', 'smtpSecure', 'true', 'boolean', 'Connexion sécurisée SSL/TLS'),
('email', 'smtpUser', 'hackersranch@gmail.com', 'string', 'Nom d''utilisateur SMTP'),
('email', 'smtpPassword', 'wftu sloa kpsq wecy', 'string', 'Mot de passe d''application Gmail'),
('email', 'fromAddress', 'hackersranch@gmail.com', 'string', 'Adresse email expéditeur'),
('email', 'fromName', 'Plateforme d''Enrichissement', 'string', 'Nom de l''expéditeur'),
('email', 'enableNotifications', 'true', 'boolean', 'Activer les notifications email'),

-- Processing Settings  
('processing', 'maxConcurrentJobs', '5', 'number', 'Nombre maximum de jobs simultanés'),
('processing', 'defaultTimeout', '30', 'number', 'Timeout par défaut en minutes'),
('processing', 'autoRefreshInterval', '5', 'number', 'Intervalle de rafraîchissement en secondes'),
('processing', 'retryAttempts', '3', 'number', 'Nombre de tentatives en cas d''échec'),
('processing', 'enableAutoCleanup', 'true', 'boolean', 'Nettoyage automatique des anciens jobs'),
('processing', 'cleanupAfterDays', '30', 'number', 'Supprimer les jobs après X jours'),

-- File Settings
('file', 'maxFileSize', '100', 'number', 'Taille maximum des fichiers en MB'),
('file', 'allowedFormats', '["zip", "csv", "xlsx"]', 'json', 'Formats de fichiers autorisés'),
('file', 'compressionFormat', 'zip', 'string', 'Format de compression par défaut'),
('file', 'enablePreview', 'true', 'boolean', 'Activer l''aperçu des résultats'),
('file', 'previewRowLimit', '10', 'number', 'Nombre de lignes dans l''aperçu'),

-- UI Settings
('ui', 'appName', 'Plateforme d''Enrichissement de Données', 'string', 'Nom de l''application'),
('ui', 'appDescription', 'Système automatisé d''enrichissement de données client', 'string', 'Description de l''application'),
('ui', 'theme', 'light', 'string', 'Thème de l''interface'),
('ui', 'language', 'fr', 'string', 'Langue de l''interface'),
('ui', 'enableAnimations', 'true', 'boolean', 'Activer les animations'),
('ui', 'itemsPerPage', '20', 'number', 'Éléments par page dans les listes'),

-- System Settings
('system', 'enableDebugLogs', 'false', 'boolean', 'Activer les logs de débogage'),
('system', 'enableMetrics', 'true', 'boolean', 'Collecter les métriques'),
('system', 'maintenanceMode', 'false', 'boolean', 'Mode maintenance'),
('system', 'maintenanceMessage', 'Maintenance en cours. Merci de revenir plus tard.', 'string', 'Message affiché en mode maintenance')

ON CONFLICT (section, key) DO NOTHING;