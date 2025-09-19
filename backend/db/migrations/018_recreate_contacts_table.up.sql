-- 018_recreate_contacts_table.up.sql

-- Step 1: Create the new contacts table with the correct schema
CREATE TABLE contacts_new (
    id BIGSERIAL PRIMARY KEY,
    civilite VARCHAR(255),
    nom VARCHAR(255),
    prenom VARCHAR(255),
    date_naissance DATE,
    age INTEGER,
    profession VARCHAR(255),
    adresse VARCHAR(255),
    adresse_complement VARCHAR(255),
    code_postal VARCHAR(255),
    ville VARCHAR(255),
    departement VARCHAR(255),
    email VARCHAR(255),
    mobile VARCHAR(255),
    phone VARCHAR(255),
    nb_enfants INTEGER,
    enfant1_date_naissance DATE,
    enfant2_date_naissance DATE,
    enfant3_date_naissance DATE,
    hexacle_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Copy data from the old table to the new table
-- This is a best-effort copy. Some columns might not exist in the old table, and some data might be lost.
INSERT INTO contacts_new (
    civilite,
    nom,
    prenom,
    date_naissance,
    age,
    profession,
    adresse,
    adresse_complement,
    code_postal,
    ville,
    departement,
    email,
    mobile,
    phone,
    nb_enfants,
    enfant1_date_naissance,
    enfant2_date_naissance,
    enfant3_date_naissance,
    hexacle_hash
)
SELECT
    civilite,
    nom,
    prenom,
    date_naissance,
    age,
    profession,
    adresse,
    adresse_complement,
    code_postal,
    ville,
    departement,
    email,
    mobile,
    phone,
    nb_enfants,
    enfant1_date_naissance,
    enfant2_date_naissance,
    enfant3_date_naissance,
    hexacle_hash
FROM contacts;

-- Step 3: Drop the old contacts table
DROP TABLE contacts;

-- Step 4: Rename the new table to contacts
ALTER TABLE contacts_new RENAME TO contacts;

-- Step 5: Recreate indexes
CREATE INDEX idx_contacts_hexacle_hash ON contacts(hexacle_hash);
