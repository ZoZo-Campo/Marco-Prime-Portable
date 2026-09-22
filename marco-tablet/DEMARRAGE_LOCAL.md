# Marco Prime — lancer et tester sur Mac Apple Silicon

## Architecture locale

- `marco-prime-backend` : API TypeScript/Hono sur le port 3000
- `marco-prime-frontend` : interface Preact/Vite sur le port 5173
- MySQL 8 : conteneur Docker géré par Colima, port 3306

Le projet n'utilise pas Python : aucun environnement `venv` n'est nécessaire.
Node et pnpm gèrent les dépendances séparément dans chacun des deux dépôts.

## 1. Préparer les fichiers d'environnement

Dans le backend :

```bash
cd "$HOME/Desktop/Marco Prime/marco-prime-backend"
cp .env.example .env
```

Pour la base de démonstration fournie par le projet, régler `DATABASE_URL` ainsi :

```env
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime
API_TOKEN=dev-marco-prime
API_AUTH_ENABLED=true
FOUAILLE_SYNC_ENABLED=true
```

Dans le frontend :

```bash
cd "$HOME/Desktop/Marco Prime/marco-prime-frontend"
cp .env.example .env.local
```

Puis renseigner le même jeton :

```env
VITE_API_URL=http://127.0.0.1:3000/api/v1
VITE_API_TOKEN=dev-marco-prime
```

## 2. Premier démarrage

```bash
colima start

cd "$HOME/Desktop/Marco Prime/marco-prime-backend"
docker-compose up -d mysql
pnpm install --frozen-lockfile
pnpm db:migrate
# À faire uniquement sur une base de démonstration vide :
pnpm db:seed
pnpm dev
```

Dans un deuxième terminal :

```bash
cd "$HOME/Desktop/Marco Prime/marco-prime-frontend"
pnpm install --frozen-lockfile
pnpm dev
```

Ouvrir ensuite :

- Interface : http://localhost:5173
- Documentation Swagger : http://localhost:3000/ui
- Santé de l'API : http://localhost:3000/health

Le backend importe automatiquement le catalogue public de Fouaille au démarrage,
puis toutes les cinq minutes. Si Fouaille est momentanément inaccessible, le
dernier catalogue enregistré reste affiché.

> Attention : `pnpm db:seed` efface les commandes, produits, membres et catégories
> de la base ciblée. Ne jamais exécuter cette commande sur Fouaille ou en production.

## Émuler une carte RFID

Le lecteur RFID est actuellement traité comme un clavier. Dans l'interface,
cliquer dans la page, saisir le numéro de carte, puis appuyer sur Entrée. Avec
une base créée par le seed, ces numéros sont générés : on peut en récupérer un
dans MySQL. Ne pas supposer que `8975` ou `1582` existent après une nouvelle
génération du jeu de données.

Pour tester le catalogue sans carte, il suffit d'ouvrir `/buy` : les produits
s'affichent mais restent désactivés tant qu'une carte valide n'a pas été scannée.

## Sélectionner les produits vendus pendant la soirée

1. Ouvrir la page `Config` dans la barre inférieure.
2. Scanner une carte dont le membre possède le droit administrateur.
3. Cocher uniquement les produits qui seront réellement vendus.
4. Appuyer sur `Enregistrer`.

L'écran `Achats` ne montre alors que cette sélection. Fouaille reste propriétaire
du nom, du tarif, de la couleur et de la disponibilité générale du produit ; la
sélection de soirée appartient uniquement à la Marco.

Au premier démarrage, avant tout enregistrement, tous les produits disponibles
sont visibles afin de préserver le comportement historique. Après la première
configuration, un nouveau produit ajouté sur Fouaille apparaît dans `Config` mais
reste décoché jusqu'à ce qu'un administrateur le sélectionne.

La sélection est enregistrée dans `data/catalog-selection.json` en développement
et dans le volume Docker `marco_prime_data` en production. Elle survit donc aux
redémarrages et aux mises à jour du conteneur. Il n'est pas nécessaire de modifier
ce fichier manuellement.

## 3. Tests et compilation

Les tests refusent maintenant de démarrer si `DATABASE_URL` ne désigne pas une
base locale dont le nom contient `test`. Cette protection évite de modifier
Fouaille par erreur. Avec le conteneur MySQL local de développement :

```bash
cd "$HOME/Desktop/Marco Prime/marco-prime-backend"
docker exec marco-prime-mysql mysql -uroot -proot \
  -e "CREATE DATABASE IF NOT EXISTS marco_prime_test; GRANT ALL PRIVILEGES ON marco_prime_test.* TO 'marco'@'%';"
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm db:push
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm db:seed
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm test
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm test:coverage
pnpm build

cd "$HOME/Desktop/Marco Prime/marco-prime-frontend"
pnpm build
```

## 4. Arrêt

Arrêter les serveurs avec `Ctrl+C` dans leurs terminaux, puis :

```bash
cd "$HOME/Desktop/Marco Prime/marco-prime-backend"
docker-compose stop
colima stop
```

Les données MySQL sont conservées dans le volume Docker.

## 5. Tester l'image de production localement

Depuis le dossier parent `Marco Prime`, créer `.env.orange-pi` depuis l'exemple,
puis adapter `DATABASE_URL` :

```bash
cd "$HOME/Desktop/Marco Prime"
cp .env.orange-pi.example .env.orange-pi
./marco check
./marco start
```

Ouvrir ensuite http://127.0.0.1:3001/. Dans cette image, Hono sert également
le frontend compilé : un seul service applicatif tourne, sans serveur Vite.

```bash
./marco status
./marco logs
```

Pour l'arrêter sans effacer les données :

```bash
./marco stop
```

`./marco` choisit automatiquement `docker-compose` sur les Mac qui utilisent
la commande autonome et `docker compose` sur Raspberry Pi. `./marco restart`
recompile et recrée l'application sans effacer la sélection des produits.

`API_PORT` doit toujours rester à `3000` : c'est le port interne du conteneur.
Pour changer l'adresse visible, modifier seulement `MARCO_HOST_PORT` (par défaut
`3001`), puis utiliser par exemple `http://127.0.0.1:3001/`.
