# Plateforme d'enrichissement - Laravel 11

Ce sous-projet réécrit l'intégralité du pipeline d'enrichissement CSV en utilisant **Laravel 11**, **PostgreSQL** et **Laravel Sanctum** pour l'API.

## Prérequis

- PHP >= 8.2 avec les extensions `zip`, `fileinfo` et `pdo_pgsql`
- Composer
- Node.js 18+
- PostgreSQL 13+

## Installation

```bash
cd laravel-app
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
npm install
npm run dev
```

Le serveur HTTP peut ensuite être lancé via:

```bash
php artisan serve
```

## Fonctionnalités principales

- Upload d'archives ZIP contenant les référentiels CSV (FTTH, 4GBOX, Mobile, Blacklist)
- Pipeline d'enrichissement asynchrone (queue `database`)
- Jointure sur la table `contacts` via le champ `hexacle`
- Application automatique de la blacklist téléphonique
- Génération d'une archive ZIP enrichie puis upload optionnel vers Cloudflare R2
- Notification par email de la fin de traitement
- Historique des jobs accessible via l'API REST

## API

Toutes les routes sont préfixées par `/api` et protégées par Sanctum.

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/login` | Authentification par email/mot de passe |
| `POST` | `/api/logout` | Révocation du token courant |
| `POST` | `/api/uploads` | Upload d'une archive ZIP et lancement de l'enrichissement |
| `GET` | `/api/jobs` | Liste paginée des jobs |
| `GET` | `/api/jobs/{id}` | Détails d'un job |

## Filesystems & Cloudflare R2

La configuration du bucket R2 s'effectue dans `.env` en utilisant le disque `r2` défini dans `config/filesystems.php`.

```env
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_DEFAULT_REGION=auto
AWS_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUD_R2_BUCKET=<bucket>
CLOUD_R2_PREFIX=enriched
```

## Tests

```bash
php artisan test
```

Les tests utilisent Pest et vérifient notamment le déclenchement du job d'enrichissement lors d'un upload.

## Planification

Une commande artisan `enrichment:cleanup` supprime quotidiennement les archives plus anciennes que la rétention configurée (`ENRICHMENT_RETENTION_DAYS`).
