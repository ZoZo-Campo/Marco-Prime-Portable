# Marco Prime

Marco Prime est une caisse tactile pour les événements de l’école. Une carte
RFID identifie un membre Fouaille, puis Marco enregistre ses achats et ses
rechargements dans la base autorisée par l’école.

La version stable actuelle est **v1.0.0**. Elle est prévue pour une Raspberry Pi
4 Model B sous Raspberry Pi OS 64 bits avec bureau, un écran tactile et un
lecteur RFID USB reconnu comme clavier.

## Fonctions principales

- paiement d’un panier contenant plusieurs produits et plusieurs quantités ;
- calcul des prix exclusivement par le backend ;
- transaction SQL unique pour le débit et toutes les lignes du panier ;
- refus d’un achat qui rendrait le solde négatif ;
- protection contre le double-clic et nouvelle tentative avec le même identifiant ;
- rechargement validé par une carte administrateur ;
- sélection des produits vendus pendant la soirée ;
- recherche de membres par promotion, création de membres et attribution/remplacement de badges (administrateur) ;
- recherche, création et activation/désactivation des produits Fouaille (administrateur) ;
- historique avec recherche, ancien solde et nouveau solde ;
- correction ou annulation administrateur d’une vente ;
- statistiques et comptabilité basée sur les litres réellement mesurés ;
- exports CSV de la soirée ;
- configuration Wi-Fi depuis l’interface sur Raspberry Pi ;
- saisie par RFID, clavier physique ou pavé tactile ;
- affichage Chromium en plein écran avec retour possible au bureau.

## Architecture

```text
Lecteur RFID / écran tactile
            │
            ▼
Frontend Preact + Vite
            │  /api/v1
            ▼
Backend TypeScript + Hono
            │
            ▼
Base MySQL Fouaille autorisée par l’école
```

En production, le frontend compilé et l’API sont réunis dans une seule image
Docker. L’application écoute uniquement sur `127.0.0.1:3001` par défaut.

Le projet n’utilise pas Python pour l’application : aucun `venv` n’est requis.
Python sert uniquement aux petits services système du kiosque Raspberry.

## Prérequis Fouaille

Avant l’installation, demander à la personne responsable :

- l’hôte MySQL ;
- le port MySQL ;
- le nom exact de la base ;
- un utilisateur MySQL dédié à Marco ;
- son mot de passe ;
- l’autorisation réseau de la Raspberry (VPN, VLAN ou liste d’adresses IP) ;
- le certificat TLS de la base si l’infrastructure l’exige.

Ne jamais publier ces informations sur GitHub.

Le compte MySQL dédié devrait disposer uniquement des droits nécessaires :

- `SELECT` sur `members`, `products`, `product_types` et `orders` ;
- `UPDATE` sur `members.balance` ;
- `INSERT` dans `orders` ;
- aucun droit `DROP`, `ALTER`, `CREATE`, `DELETE` ou de gestion des utilisateurs.

Les fonctions de gestion Fouaille dans **Config** demandent en plus `INSERT` sur
`members` et `products`, ainsi que `UPDATE` sur `members.card_number` et
`products.available`. Elles modifient la base partagée par toutes les Marco ;
la sélection « vendu ce soir » reste un réglage local. Si ces droits ne sont pas
accordés par l’école, les paiements continuent de fonctionner mais ces actions
administratives échouent. Avec `FOUAILLE_SYNC_ENABLED=true`, la création et la
disponibilité des produits depuis Marco sont bloquées : la synchronisation
écraserait autrement ces modifications.

Faire confirmer que la base possède notamment `members.card_number`,
`members.balance`, `members.admin`, `products.available`,
`products.product_type_id` et les colonnes attendues de `orders`.

## Installation sur Raspberry Pi 4

### 1. Préparer la Raspberry

Installer une version récente de **Raspberry Pi OS 64 bits avec bureau**. Vérifier
l’architecture :

```bash
uname -m
```

Le résultat attendu est `aarch64`.

### 2. Télécharger Marco Prime

Ouvrir un terminal sur la Raspberry :

```bash
cd "$HOME/Desktop"
git clone https://github.com/ZoZo-Campo/Marco-Prime.git
cd Marco-Prime
```

Si le dossier a été téléchargé comme archive ZIP, entrer simplement dans ce
dossier avant de continuer.

### 3. Configurer la connexion

```bash
cp .env.orange-pi.example .env.orange-pi
nano .env.orange-pi
```

Les valeurs essentielles sont :

```env
API_AUTH_ENABLED=false
API_TOKEN=

DATABASE_URL=mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:PORT/NOM_DE_LA_BASE

FOUAILLE_API_URL=https://fouaille.bde-tps.fr/api/product
FOUAILLE_SYNC_ENABLED=false
FOUAILLE_SYNC_INTERVAL_MS=300000

MARCO_DATA_DIR=/app/data
API_PORT=3000
MARCO_HOST_PORT=3001
MARCO_KIOSK_SCALE=1.75
NODE_ENV=production
TZ=Europe/Paris
FRONTEND_URL=http://127.0.0.1:3001
```

Règles importantes :

- conserver `API_PORT=3000` ;
- modifier seulement `MARCO_HOST_PORT` si le port `3001` est occupé ;
- laisser `FOUAILLE_SYNC_ENABLED=false` lors d’une connexion directe à la base ;
- encoder les caractères spéciaux du nom d’utilisateur ou du mot de passe dans
  l’URL MySQL ;
- ne jamais copier le mot de passe dans le frontend.

Protéger le fichier :

```bash
chmod 600 .env.orange-pi
```

### 4. Installer les dépendances

```bash
chmod +x marco install-raspberry-pi.sh lancer-marco.sh
sudo ./install-raspberry-pi.sh "$USER"
sudo reboot
```

Le script installe Docker, Docker Compose, Chromium, NetworkManager et le
raccourci **Lancer Marco Prime** sur le bureau. Marco ne masque pas le bureau et
ne se lance pas automatiquement au démarrage de Debian.

### 5. Lancer Marco

Après le redémarrage, double-cliquer sur **Lancer Marco Prime**, puis choisir
**Exécuter dans un terminal**.

Le lanceur :

1. tente un `git pull --ff-only` sans écraser les changements locaux ;
2. conserve la version installée si GitHub est indisponible ;
3. reconstruit et démarre Docker ;
4. attend que l’API réponde et signale si la base est encore indisponible ;
5. ouvre `http://127.0.0.1:3001/` dans Chromium en plein écran.

Deux clics successifs ne lancent pas deux constructions : le second terminal
indique que Marco est déjà en cours de lancement.

Le même démarrage est possible depuis un terminal graphique :

```bash
cd "$HOME/Desktop/Marco-Prime"
./lancer-marco.sh
```

## Première utilisation

1. Ouvrir **Config**.
2. Scanner une carte administrateur, saisir son numéro puis appuyer sur `Entrée`,
   ou utiliser le pavé numérique tactile.
3. Dans **Catalogue**, cocher uniquement les produits vendus pendant la soirée.
4. Appuyer sur **Enregistrer**.
   Pour changer un tarif, utiliser **Modifier le prix** sur la carte du produit
   dans Catalogue. Cette action modifie le prix global dans Fouaille pour les
   prochains achats, y compris sur les autres Marco ; elle ne change pas les
   ventes déjà enregistrées. Enregistrer d'abord toute sélection en cours.
5. Revenir sur Home puis ouvrir **Achats**.
6. Scanner une carte membre, constituer le panier et vérifier le total.
7. Appuyer une seule fois sur **Payer** et attendre le ticket de confirmation.

Pour revenir au bureau, ouvrir **Config**, s’authentifier comme administrateur et
utiliser **Fermer Marco**. Cette action ferme Chromium ; le conteneur peut rester
actif jusqu’à son arrêt manuel ou au prochain redémarrage de la machine.

## Commandes utiles

À exécuter depuis la racine du projet :

```bash
./marco check      # vérifier .env.orange-pi et Docker Compose
./marco start      # construire si nécessaire et démarrer
./marco rebuild    # reconstruire et recréer le conteneur
./marco restart    # même comportement que rebuild
./marco status     # afficher l’état et le port
./marco logs       # suivre les journaux ; quitter avec Ctrl+C
./marco stop       # arrêter les conteneurs sans effacer les données
```

Le script choisit automatiquement `docker compose` sur Raspberry Pi et
`docker-compose` sur les Mac qui utilisent encore la commande autonome.

## Mise à jour

La méthode normale est de fermer Marco puis de relancer son icône : le lanceur
tente lui-même la mise à jour et la reconstruction.

Mise à jour manuelle :

```bash
cd "$HOME/Desktop/Marco-Prime"
git pull --ff-only origin main
./marco rebuild
```

Le volume Docker conserve la sélection du catalogue, les prix d’achat, les
brouillons de comptabilité et le journal local des corrections.

## Utilisation sur Mac

Docker Desktop ou Colima avec `docker-compose` est requis.

```bash
git clone https://github.com/ZoZo-Campo/Marco-Prime.git
cd Marco-Prime
cp .env.orange-pi.example .env.orange-pi
```

Compléter `.env.orange-pi`, puis :

```bash
./marco check
./marco start
```

Ouvrir [http://127.0.0.1:3001/](http://127.0.0.1:3001/).

Pour un développement avec frontend et backend séparés, consulter
[`DEMARRAGE_LOCAL.md`](DEMARRAGE_LOCAL.md). Utiliser obligatoirement une base
locale de démonstration.

## Tests

Les tests refusent de démarrer si `DATABASE_URL` ne vise pas `localhost` et une
base dont le nom contient `test`. Cette protection évite de modifier Fouaille.

```bash
cd marco-prime-backend
docker-compose up -d mysql
docker exec marco-prime-mysql mysql -uroot -proot \
  -e "CREATE DATABASE IF NOT EXISTS marco_prime_test; GRANT ALL PRIVILEGES ON marco_prime_test.* TO 'marco'@'%';"

DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm db:push
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm db:seed
DATABASE_URL=mysql://marco:marco123@127.0.0.1:3306/marco_prime_test pnpm test
```

Compilation :

```bash
cd marco-prime-backend && pnpm build
cd ../marco-prime-frontend && pnpm build
```

> `pnpm db:seed` efface et remplace le contenu de la base ciblée. Ne jamais
> exécuter `db:seed`, `db:push` ou `db:migrate` sur la base Fouaille officielle.

## Dépannage

### Marco ne s’ouvre pas

```bash
./marco status
./marco logs
sudo systemctl status docker --no-pager
```

Vérifier également [http://127.0.0.1:3001/](http://127.0.0.1:3001/) dans un
navigateur normal.

### `unknown shorthand flag: 'f' in -f`

La machine ne possède pas la sous-commande `docker compose`. Utiliser `./marco`,
qui sélectionne automatiquement la commande compatible.

### Le lecteur RFID émet un bip mais aucune carte n’est reconnue

- vérifier qu’il écrit uniquement des chiffres ;
- vérifier la disposition AZERTY/QWERTY de Raspberry Pi OS ;
- tester la carte dans un champ de texte ;
- utiliser provisoirement le clavier physique ou le pavé tactile.

### L’interface est trop petite sur l’écran Raspberry

Le lanceur utilise maintenant l'échelle `1.75` automatiquement, y compris
si un ancien `.env.orange-pi` contient la valeur historique `1.25`.
Aucune modification du fichier de configuration n'est nécessaire.

Si cette échelle ne convient pas à votre écran, vous pouvez néanmoins la
personnaliser dans `.env.orange-pi` :

```env
MARCO_KIOSK_SCALE=1.75
```

Fermer puis relancer le kiosque. Le lanceur utilise un profil Chromium séparé :
le zoom réglé dans Chromium ouvert manuellement ne s'applique pas à Marco.
Si `1.75` est trop grand sur votre écran, essayer `1.5` ; s'il reste trop
petit, essayer `2.0`. Aucun rebuild Docker n'est nécessaire pour ce réglage.

### La base ou Fouaille apparaît en rouge

Vérifier le réseau, le VPN/VLAN, les identifiants MySQL et les journaux. Ne pas
réessayer aveuglément une opération marquée **résultat incertain** : consulter
d’abord l’historique et le solde du membre.

## Sécurité et limites de cette version

- `.env.orange-pi` est ignoré par Git et doit rester lisible uniquement par son
  propriétaire (`chmod 600`) ;
- le port applicatif est lié à `127.0.0.1` et ne doit pas être exposé sur Internet ;
- utiliser un compte MySQL dédié, restreint au réseau et aux droits nécessaires ;
- aucune opération de paiement hors connexion n’est effectuée dans cette version ;
- les protections contre la répétition sont prévues pour une instance locale ;
- le journal des corrections est local à chaque Marco : avec plusieurs caisses,
  effectuer les corrections depuis une seule machine ;
- pour plusieurs Marco ou une exposition réseau, déployer ultérieurement le
  backend central HTTPS afin que les secrets MySQL ne soient plus sur les caisses.

## Documentation complémentaire

- [`INSTALLATION_RASPBERRY_PI_4.txt`](INSTALLATION_RASPBERRY_PI_4.txt) : procédure
  Raspberry détaillée pas à pas ;
- [`DEMARRAGE_LOCAL.md`](DEMARRAGE_LOCAL.md) : développement et tests sur Mac ;
- [`marco-prime-backend/README.md`](marco-prime-backend/README.md) : API,
  endpoints et architecture interne du backend.

## Licence et responsabilité

Le dépôt ne contient aucun identifiant de production. L’accès à la base Fouaille
et l’utilisation en événement doivent être autorisés par l’association et
l’établissement concernés.
