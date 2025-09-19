# Pipeline d'Enrichissement Automatisé

Application de traitement automatisé de fichiers CSV avec enrichissement de données et historisation.

## 🎯 Fonctionnalités

- **Upload de fichiers** : Interface web pour uploader des fichiers ZIP contenant les référentiels CSV
- **Enrichissement automatique** : Jointure avec la base de données interne sur le champ HEXACLE
- **Blacklist** : Application automatique des exclusions de la blacklist mobile
- **Compression** : Génération de fichiers .rar avec les données enrichies
- **Stockage cloud** : Upload automatique vers Cloudflare R2
- **Notifications** : Envoi d'emails avec liens de téléchargement
- **Historique** : Interface de suivi des traitements avec statistiques

## 📋 Types de fichiers supportés

- `Referentiel_Zone_FTTH_[MMYYYY].csv`
- `Referentiel_Zone_4GBOX_[MMYYYY].csv`
- `Referentiel_mobile_[MMYYYY].csv`
- `Blacklist_mobile_[MMYYYY].csv`

## 🚀 Architecture

### Backend (Encore.ts)
- **Service upload** : Gestion des fichiers entrants
- **Service enrichment** : Pipeline ETL d'enrichissement
- **Service storage** : Interface Cloudflare R2
- **Service notification** : Envoi d'emails SMTP
- **Service history** : Historique des traitements
- **Service auth** : Authentification basique

### Frontend (React + TypeScript)
- Interface d'upload responsive
- Tableau de bord avec historique
- Authentification sécurisée
- Design moderne avec Tailwind CSS

### Base de données (PostgreSQL)
- Table `contacts` : Données internes avec HEXACLE
- Table `job_history` : Historique des traitements
- Table `users` : Comptes utilisateurs

## ⚙️ Configuration

1. **Configurer Cloudflare R2** dans `frontend/config.ts` :
```typescript
r2: {
  accessKeyId: 'your-r2-access-key',
  secretAccessKey: 'your-r2-secret-key',
  endpoint: 'https://account-id.r2.cloudflarestorage.com',
  bucketName: 'your-bucket-name',
}
```

2. **Configurer SMTP** dans `frontend/config.ts` :
```typescript
smtp: {
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password',
  },
}
```

3. **Créer un utilisateur admin** via l'API ou directement en base :
```sql
INSERT INTO users (username, password, email, role) 
VALUES ('admin', 'hashed_password', 'admin@company.com', 'admin');
```

## 🔄 Processus de traitement

1. **Upload** : L'utilisateur uploade un fichier ZIP via l'interface
2. **Extraction** : Le système extrait et valide les fichiers CSV
3. **Import** : Import des données en chunks dans PostgreSQL
4. **Enrichissement** : Jointure avec la table contacts sur HEXACLE
5. **Blacklist** : Exclusion des numéros de téléphone blacklistés
6. **Export** : Génération des fichiers CSV enrichis
7. **Compression** : Création d'un fichier .rar
8. **Upload R2** : Stockage sur Cloudflare R2
9. **Notification** : Envoi d'email avec lien de téléchargement

## 📊 Données d'exemple

### Table contacts
```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  hexacle VARCHAR(50) UNIQUE NOT NULL,
  prenom VARCHAR(100),
  nom VARCHAR(100),
  email VARCHAR(255),
  telephone VARCHAR(20),
  age INTEGER
);
```

### Exemple de données
```sql
INSERT INTO contacts (hexacle, prenom, nom, email, telephone, age) VALUES
('HEX001', 'Jean', 'Dupont', 'jean.dupont@email.com', '0123456789', 35),
('HEX002', 'Marie', 'Martin', 'marie.martin@email.com', '0987654321', 28);
```

## 🛡️ Sécurité

- Authentification basique avec sessions
- Validation des types de fichiers
- Limitation de taille des uploads
- Nettoyage automatique des fichiers temporaires
- Logs détaillés des opérations

## 📈 Monitoring

L'interface d'historique affiche :
- Date et heure de traitement
- Nombre d'enregistrements traités
- Nombre d'enregistrements enrichis
- Nombre d'exclusions blacklist
- Statut du job (en cours, terminé, erreur)
- Lien de téléchargement

## 🔧 Maintenance

- Les fichiers temporaires sont automatiquement supprimés après traitement
- Les liens de téléchargement expirent après 24h
- Les logs de traitement sont conservés en base de données
- Sauvegarde recommandée de la base PostgreSQL

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs dans l'interface d'historique
2. Contrôler la configuration dans `frontend/config.ts`
3. Vérifier la connectivité R2 et SMTP