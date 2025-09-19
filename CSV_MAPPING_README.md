# Système de Mapping de Colonnes CSV

## Vue d'ensemble

Le système de mapping de colonnes CSV permet aux utilisateurs d'importer des fichiers CSV avec des headers personnalisés en les associant automatiquement ou manuellement aux colonnes de la base de données.

## Fonctionnalités

### 1. **Mapping Automatique Intelligent**
- Détection automatique des correspondances basée sur les patterns communs
- Support des variations linguistiques (français/anglais)
- Matching flexible (correspondance exacte et partielle)

### 2. **Interface de Mapping Manuel**
- Interface intuitive pour corriger ou ajuster les mappings
- Indication visuelle des mappings automatiques vs manuels
- Validation en temps réel des types de données

### 3. **Conversion de Types de Données**
- **String**: Texte simple
- **Integer**: Validation et conversion des nombres entiers
- **Boolean**: Support multiple formats (true/false, oui/non, 1/0)
- **Date**: Formats multiples (DD/MM/YYYY, YYYY-MM-DD, etc.)
- **DateTime**: Dates avec composantes temporelles

## Utilisation

### Dans l'Upload Principal (Dashboard)
1. Onglet "Upload avec mapping"
2. Sélectionner fichier CSV
3. Mapper les colonnes automatiquement/manuellement
4. Upload avec validation

### Dans les Paramètres (Configuration Contacts)
1. Aller dans Paramètres > Sources > Configuration de la table des contacts
2. Sélectionner fichier CSV
3. Le système propose automatiquement des mappings
4. Ajuster si nécessaire et uploader directement

## Patterns de Mapping Supportés

### Contacts
- **Email**: email, mail, e-mail, adresse_email
- **Mobile**: mobile, portable, gsm, tel_mobile
- **Nom**: nom, lastname, family_name
- **Prénom**: prenom, firstname, given_name
- **Adresse**: adresse, address, street, rue
- **Ville**: ville, city, town
- **Code Postal**: code_postal, cp, zip
- **Age**: age, années, ans
- Et bien d'autres...

## Architecture Technique

### Backend
- `backend/settings/contact_mapping.ts`: Analyse et suggestions de mapping
- `backend/settings/contacts.ts`: Endpoints d'upload avec mapping
- `backend/upload/mapping.ts`: Mapping générique (réutilisable)

### Frontend
- `frontend/components/ContactColumnMapping.tsx`: Interface de mapping pour contacts
- `frontend/components/ColumnMapping.tsx`: Interface de mapping générique
- `frontend/components/FileUploadWithMapping.tsx`: Upload avec workflow complet

## Gestion des Erreurs

- Validation des types de données avant insertion
- Messages d'erreur détaillés par ligne
- Limitation à 10 premières erreurs pour éviter le spam
- Rollback automatique en cas d'erreur critique

## Extension Future

Le système est conçu pour être extensible :
- Ajout de nouveaux patterns de mapping
- Support de nouveaux types de données
- Mapping pour d'autres tables/entités
- Sauvegarde des configurations de mapping.