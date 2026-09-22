# Marco Prime Backend API

API backend pour la gestion des commandes, produits, membres et recharges de Marco Prime.

## Technologies

- **[Hono](https://hono.dev/)** - Framework web léger et rapide
- **[Drizzle ORM](https://orm.drizzle.team/)** - ORM TypeScript moderne
- **[Zod](https://zod.dev/)** - Validation de schémas
- **[MySQL](https://www.mysql.com/)** - Base de données
- **[Vitest](https://vitest.dev/)** - Framework de tests
- **[TypeScript](https://www.typescriptlang.org/)** - Typage statique

## Prérequis

- Node.js 20+
- pnpm
- MySQL 8+

## Installation

```bash
# Cloner le dépôt
git clone <repo-url>
cd backend

# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
```

## Configuration

Créer un fichier `.env` à la racine du projet:

```env
# API
API_PORT=3000
API_TOKEN=your-secret-token

# Database
DATABASE_URL=mysql://user:password@localhost:3306/database_name

# Environment
NODE_ENV=development
TZ=Europe/Paris
```

## Scripts disponibles

### Développement

```bash
# Démarrer le serveur en mode développement
pnpm dev

# Lancer les tests
pnpm test

# Lancer les tests en mode watch
pnpm test:watch

# Générer le rapport de couverture
pnpm test:coverage
```

### Production

```bash
# Compiler le projet
pnpm build

# Démarrer le serveur en production
pnpm start
```

### Base de données

```bash
# Synchroniser le schéma avec la base de données
pnpm db:push

# Générer les migrations
pnpm db:generate

# Appliquer les migrations
pnpm db:migrate

# Ouvrir Drizzle Studio
pnpm db:studio

# Remplir la base avec des données de test
pnpm db:seed
```

## Documentation API

Une documentation Swagger UI interactive est disponible une fois le serveur démarré:

- **Swagger UI**: http://localhost:3000/ui
- **Spécification OpenAPI**: http://localhost:3000/doc

## Endpoints principaux

### Santé
- `GET /health` - Vérifier l'état de l'API

### Membres
- `GET /api/v1/member/:card_number` - Récupérer un membre par numéro de carte
- `POST /api/v1/members/search` - Rechercher un membre par nom et/ou promotion (carte administrateur requise)
- `POST /api/v1/admin/promotions` - Lister les promotions (administrateur)
- `POST /api/v1/admin/members/search` - Rechercher les membres, avec ou sans badge (administrateur)
- `POST /api/v1/admin/members` - Créer un membre Fouaille avec solde initial nul (administrateur)
- `PUT /api/v1/admin/members/badge` - Attribuer ou remplacer son badge sans toucher au solde ni à l’historique (administrateur)

Dans les écrans d’achat et de rechargement, **Rechercher sans carte** ouvre un
clavier tactile AZERTY intégré. Une carte administrateur doit d’abord autoriser
la recherche ; le client choisi suit ensuite exactement le même parcours qu’un
client identifié par RFID.

### Produits
- `GET /api/v1/products` - Lister tous les produits
- `GET /api/v1/product-types` - Lister les catégories avec leur nombre de produits disponibles
- `GET /api/v1/products/:product_type_id` - Lister les produits disponibles d'une catégorie (paginé)
- `GET /api/v1/catalog-selection` - Lister le catalogue Fouaille et la sélection locale Marco
- `PUT /api/v1/catalog-selection` - Remplacer la sélection locale (carte administrateur requise)
- `POST /api/v1/admin/product-types` - Lister toutes les catégories Fouaille (administrateur)
- `POST /api/v1/admin/products` - Créer un produit indisponible par défaut (administrateur)
- `PUT /api/v1/admin/products/availability` - Modifier la disponibilité globale Fouaille (administrateur)

La disponibilité Fouaille est partagée entre les caisses. La sélection des
produits vendus ce soir est propre à la Marco. Les mutations de produits sont
refusées si `FOUAILLE_SYNC_ENABLED=true`, car la synchronisation écraserait
ces changements. Ces actions nécessitent des droits MySQL `INSERT` sur
`members`/`products` et `UPDATE` sur `members.card_number`/`products.available`.

### Commandes
- `GET /api/v1/history` - Historique paginé, filtrable par nom, produit, date ou numéro de transaction
- `POST /api/v1/purchase` - Créer un achat
- `POST /api/v1/order-corrections` - Lister les ventes récentes corrigibles (administrateur)
- `POST /api/v1/order-corrections/apply` - Annuler ou remplacer une vente (administrateur)

Un achat est refusé avant toute écriture si son total dépasse le solde du
membre. Le contrôle est refait dans la transaction MySQL après verrouillage du
membre : deux Marco utilisées en même temps ne peuvent donc pas faire passer le
solde sous zéro. Un paiement laissant exactement `0,00 €` reste autorisé. La
même protection s’applique à une correction qui augmenterait le montant débité.

Une correction conserve la vente d’origine pour l’audit. Dans une même
transaction MySQL, Marco rembourse intégralement cette vente, crée
éventuellement la ligne de remplacement et ajuste le solde une seule fois. Le
journal local `order-corrections.json` empêche de corriger deux fois la même
vente. Une correction laissée dans l’état `pending` après une coupure doit être
vérifiée par un administrateur avant toute intervention manuelle.

Dans l’interface, la correction se fait directement en touchant une ligne de
l’onglet **Historique**. Une carte administrateur et un motif d’au moins trois
caractères sont exigés. Le motif reste ensuite visible dans le détail des
écritures de correction.

### Statistiques (carte administrateur requise)
- `POST /api/v1/statistics` - Calculer recettes, coûts et bénéfice sur une période
- `POST /api/v1/statistics/costs` - Lire les prix d'achat enregistrés localement
- `PUT /api/v1/statistics/costs` - Enregistrer les prix d'achat dans le volume Marco

Les prix d'achat sont conservés dans `product-costs.json` sous
`MARCO_DATA_DIR`. Ils ne modifient jamais la base Fouaille. Les rechargements
sont présentés séparément des recettes de vente.

### Compta réelle (carte administrateur requise)
- `POST /api/v1/accounting` - Lire le tableau de comptabilité locale
- `PUT /api/v1/accounting` - Enregistrer le tableau de comptabilité locale
- `POST /api/v1/accounting/export` - Préparer l’export complet d’une soirée

Ce tableau est volontairement indépendant des ventes théoriques de Marco. Les
litres réellement mesurés, le prix d’achat par litre et les recettes réelles
sont saisis manuellement. Marco calcule seulement le coût total et le résultat
(`recettes - coût`). Il n’y a ni HT, ni TVA, ni brut/net. Les données sont
conservées dans `accounting.json` sous `MARCO_DATA_DIR`. Chaque ligne référence
un produit réel du catalogue Fouaille. Le brouillon s’enregistre automatiquement
et indique son état à l’écran. **Préremplir depuis les ventes** récupère les
recettes Marco entre 17 h et minuit, tout en laissant chaque montant modifiable.
Les produits actuellement disponibles sont affichés avant les anciens produits
ou produits hors vente.

**Nouvelle soirée** remet à zéro la date, les litres et les recettes, avec le
choix de conserver ou non les produits habituels. Les derniers prix d’achat au
litre strictement positifs restent mémorisés. La clôture guidée vérifie les prix,
les litres et l’export avant de verrouiller le bilan ; une soirée clôturée peut
être rouverte explicitement.

L’export complet demande un dossier à Chromium puis crée `compta.csv`,
`ventes.csv`, `rechargements.csv`, `corrections.csv` et
`sauvegarde-marco.json`. Si le sélecteur de dossier n’est pas disponible, les
fichiers sont téléchargés dans le dossier configuré dans Chromium.

### Recharges
- `POST /api/v1/recharge` - Recharger le solde d'un membre

## Architecture

```
src/
├── config/          # Configuration (database, router, openapi, logger)
├── controllers/     # Logique métier des routes
├── repositories/    # Accès à la base de données
├── middlewares/     # Middlewares (auth, errors, rate-limiter)
├── validators/      # Schémas de validation Zod
├── db/             # Schéma Drizzle et seed
└── index.ts        # Point d'entrée de l'application
```

### Couches de l'application

1. **Controllers** - Gèrent les requêtes HTTP et la logique métier
2. **Repositories** - Encapsulent les requêtes vers la base de données
3. **Middlewares** - Gestion de l'authentification, erreurs, logging
4. **Validators** - Validation des données entrantes avec Zod

## Sécurité

- **Authentification** - Bearer token sur toutes les routes `/api/v1/*`
- **Rate limiting** - 100 requêtes par minute par IP
- **Validation** - Validation stricte des entrées avec Zod
- **Error handling** - Gestion centralisée des erreurs avec HTTPException

## Tests

Le projet utilise Vitest pour les tests unitaires et d'intégration.

```bash
# Lancer tous les tests
pnpm test

# Mode watch
pnpm test:watch

# Avec couverture
pnpm test:coverage
```

Les tests couvrent:
- Routes health
- CRUD membres
- CRUD produits
- Historique des commandes
- Création d'achats
- Recharges de solde

## Fonctionnalités

### Rate Limiting
- Limite de 100 requêtes par minute par IP
- Désactivé en environnement de test
- Basé sur les headers `x-forwarded-for` et `x-real-ip`

### Logging
- Logs HTTP avec timestamps
- Rotation quotidienne des fichiers de logs
- Désactivé en environnement de test

### Gestion d'erreurs
- Utilisation de `HTTPException` de Hono
- Conversion automatique en JSON
- Messages d'erreur clairs et structurés

## Base de données

### Schéma principal

- **members** - Informations des membres
- **products** - Catalogue de produits
- **product_types** - Catégories de produits
- **orders** - Historique des commandes

### Seed

La commande `pnpm db:seed` génère:
- 4 types de produits
- 30 membres (avec admins)
- 20 produits
- 100 commandes historiques

## Licence

Propriétaire - Info Telecom Strasbourg
