-- Add missing file settings that are referenced in the code but not in the initial migration
INSERT INTO app_settings (section, key, value, value_type, description) VALUES
('file', 'separator', ';', 'string', 'Séparateur CSV par défaut')
ON CONFLICT (section, key) DO NOTHING;

-- Add missing FTP settings that are referenced in the code but not in the initial migration
INSERT INTO app_settings (section, key, value, value_type, description) VALUES
('ftp', 'globalEnabled', 'true', 'boolean', 'Activer le système FTP global'),
('ftp', 'defaultPollInterval', '60', 'number', 'Intervalle de polling par défaut en secondes'),
('ftp', 'maxConcurrentDownloads', '3', 'number', 'Nombre maximum de téléchargements simultanés'),
('ftp', 'downloadTimeout', '300', 'number', 'Timeout de téléchargement en secondes'),
('ftp', 'retryAttempts', '3', 'number', 'Nombre de tentatives en cas d''échec'),
('ftp', 'retryDelay', '30', 'number', 'Délai entre les tentatives en secondes'),
('ftp', 'tempDirectory', '/tmp/ftp-downloads', 'string', 'Répertoire temporaire pour les téléchargements'),
('ftp', 'enableNotifications', 'true', 'boolean', 'Activer les notifications FTP')
ON CONFLICT (section, key) DO NOTHING;