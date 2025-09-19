-- Retirer la contrainte NOT NULL de la colonne hexacle originale car elle n'est plus utilisée
ALTER TABLE contacts ALTER COLUMN hexacle DROP NOT NULL;