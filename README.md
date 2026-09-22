# Marco Prime Portable — Version Tablette Locale

**Version portable** de Marco Prime (caisse tactile RFID) adaptée pour tourner **100 % en local** sur une tablette Lenovo TB-X605F (Android 9) sans Raspberry Pi, sans Docker, sans internet.

---

## 📦 Contenu du projet

```
Marco-Prime-Portable/
├── marco-tablet/           # Application complète (frontend + backend + PWA)
│   ├── marco-prime-frontend/   # Preact + TypeScript + Vite (port 3001)
│   ├── marco-prime-backend/    # Node.js + Express + TypeScript (API REST)
│   ├── frontend-pwa/           # manifest.json, sw.js, icons PWA
│   ├── data/                   # Sélection catalogue (catalog-selection.json)
│   ├── package.json            # Workspace pnpm (scripts dev/build)
│   └── *.sh / *.md             # Scripts & docs d'origine
├── tablet-scripts/         # Scripts d'automatisation tablette (Termux)
│   ├── build-front.sh          # Build frontend + injection PWA + copy → backend/public
│   ├── watchdog.sh             # Relance auto du serveur si crash (boucle 15 s)
│   ├── marco.sh                # Boot script (screen off, fullscreen, serveur, watchdog)
│   ├── copy-front.sh           # Copie front → public backend
│   ├── inject-pwa.sh           # Injection manifest + service worker dans index.html
│   ├── restart-marco.sh        # Redémarrage propre
│   ├── verify-front.sh         # Vérification frontend servi
│   ├── check-pwa.sh            # Test PWA
│   ├── install-pwa.sh          # Installation PWA locale
│   └── restart-marco.sh
└── .gitignore              # Exclut node_modules, dist, logs, data sensible
```

---

## 🚀 Démarrage rapide (sur la tablette)

### Prérequis
- **Termux** (F-Droid) + `pkg install nodejs pnpm`
- **Bromite** (navigateur PWA)
- `adb` pour déploiement initial (ou copier `marco-tablet/` via USB/SSH)

### Installation
```bash
# Dans Termux
cd ~/marco-tablet
pnpm install          # installe backend + frontend
pnpm run build        # build frontend (Vite)
./build-front.sh      # build + PWA + copy → backend/public
./marco-prime-backend/dist/index.js  # lance le serveur (port 3001)
```

### Automatisation au boot (recommandée)
```bash
# Copier le boot script
mkdir -p ~/.termux/boot
cp tablet-scripts/marco.sh ~/.termux/boot/marco.sh
chmod +x ~/.termux/boot/marco.sh
```
Le script `marco.sh` configure :
- **Écran jamais en veille** (`screen_off_timeout=2147483647`, `stay_on_while_plugged_in=7`)
- **Mode immersif plein écran** pour Bromite
- Démarrage **immédiat** du serveur Node
- Lancement du **watchdog** (relance auto si crash)
- Build frontend en **arrière-plan** (non bloquant)

> ⚠️ **Pas d'auto-ouverture du navigateur** : l'utilisateur lance Marco via l'icône PWA sur le bureau.

---

## 🔧 Architecture technique

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Frontend** | Preact + TypeScript + Vite + Tailwind | UI tactile, gestion panier, membres, scan RFID |
| **Backend** | Node.js + Express + TypeScript + Zod | API REST, auth, BDD SQLite, transactions SQL |
| **Base** | SQLite (fichier `data/marco.db`) | Membres, produits, ventes, stats — **locale** |
| **PWA** | Service Worker + manifest + icons | Offline-first, installable, fullscreen |
| **Scan RFID** | Lecteur USB (mode clavier/HID) + buffer clavier | Détection rapide (≤100 ms) → auto-commit 180 ms |

### Flux principal
1. **Scan carte RFID** → buffer clavier → `useRfid` → `submitRfid()` → GET `/api/v1/member/:cardNumber`
2. **Membre chargé** → affichage solde + panier verrouillé/déverrouillé
3. **Ajout produits** → clic bouton → `shopping.append(product)` → feedback visuel (pulse vert) + son bref
4. **Paiement** → POST `/api/v1/purchase` (transaction unique) → mise à jour solde + historique
5. **Rechargement** → carte admin + montant → POST `/api/v1/recharge`

### Routes clés (publiques, sans admin)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/member-promotions` | Liste promotions (pour filtre recherche) |
| GET | `/api/v1/member/:cardNumber` | Récupère membre par n° carte |
| POST | `/api/v1/members/search` | Recherche nom/prénom/promo/n° carte |
| POST | `/api/v1/purchase` | Valide un panier (transaction) |
| POST | `/api/v1/recharge` | Recharge solde (carte admin) |

---

## 🎮 Interface utilisateur (améliorations récentes)

| Fonction | Implémentation |
|----------|----------------|
| **Clavier natif Android** | Champ recherche → `inputMode="text"` → clavier système (plus de clavier AZERTY custom géant) |
| **Pavé numérique** | Intégré dans la modale « Rechercher un membre » pour saisir un n° de carte sans clavier physique |
| **Retour visuel scan** | Flash vert/rouge (450 ms) + bip WebAudio (OK 988/1319 Hz, erreur 220/165 Hz) + vibration |
| **Retour visuel article** | Pulse vert sur le bouton produit cliqué + micro-bip |
| **Membres récents** | 6 derniers scannés (localStorage `marco.recent-members`) → puces cliquables |
| **Changement membre** | Bouton « Changer de membre » + auto-reset panier au nouveau scan |

---

## 📱 PWA & Mode kiosque

- `frontend-pwa/manifest.json` : `display: "standalone"`, `orientation: "landscape"`
- `sw.js` : cache statique + `networkFirst` pour `/api/*`
- Installation : ouvrir `http://localhost:3001/buy` dans Bromite → ☰ → « Installer l'application »
- Mode immersif : `settings put global policy_control immersive.full=org.bromite.bromite`
- Icône sur le bureau → lance l'app en plein écran sans barre d'adresse

---

## 🛡️ Robustesse & surveillance

| Outil | Rôle |
|-------|------|
| `watchdog.sh` | Boucle 15 s → `pgrep node dist/index.js` → relance + log |
| `marco.sh` (boot) | Purge setup région, configs écran, démarrage serveur + watchdog, build en fond |
| `settings` système | Veille désactivée, fullscreen forcé |
| Logs | `marco-prime-backend/server.log` (rotation manuelle) |

---

## 📂 Données & persistence

- `marco-tablet/data/marco.db` : **Base SQLite unique** (membres, produits, ventes, rechargements)
- `marco-tablet/data/catalog-selection.json` : Catalogue actif pour la soirée
- `localStorage` navigateur : `marco.recent-members` (6 derniers), préférences UI
- **Sauvegarde** : copier le dossier `marco-tablet/data/` régulièrement

---

## 🔄 Déploiement & mises à jour

### Build frontend (après modifs code)
```bash
cd ~/marco-tablet/marco-prime-frontend
pnpm run build
~/build-front.sh          # injecte PWA + copie vers backend/public
```

### Mise à jour code (depuis GitHub — optionnel)
Le repo d'origine est `https://github.com/ZoZo-Campo/Marco-Prime`. Cette version portable **ne synchronise pas** avec l'amont : elle vit en local sur la tablette. Pour intégrer des changements amont, faire un merge manuel.

### Ajout d'un script tablette
Placez-le dans `tablet-scripts/`, rendez-le exécutable, appelez-le depuis `marco.sh` ou `watchdog.sh` si besoin.

---

## ⚠️ Points d'attention / Limitations

| Sujet | Détail |
|-------|--------|
| **Pas de root / `su`** | Android 9 Lenovo : `su` indisponible via `adb shell` → scripts utilisent `run-as com.termux` pour opérations fichiers |
| **`100dvh` WebView bug** | Layout racine utilise `h-screen` (100vh stable) au lieu de `100dvh` (864 px > 800 px viewport) |
| **Clavier virtuel** | Après ouverture/fermeture, `dvh` peut décaler le bandeau bas → recharger la page (`location.reload()`) remet propre |
| **Un seul onglet CDP** | Chrome DevTools flaky avec plusieurs onglets → garder 1 onglet `/buy` |
| **Base SQLite** | Fichier unique — pas de réplication. Sauvegardez `data/` avant toute manip risquée. |
| **Heure système** | Pas de NTP auto → vérifier `date` au boot si horodatage critique |

---

## 📋 Checklist mise en production (soirée)

- [ ] Tablette chargée / branchée
- [ ] Lecteur RFID branché (USB OTG) + reconnu (test scan → son + membre affiché)
- [ ] Serveur répond `curl http://localhost:3001/ping` → `200`
- [ ] PWA installée + icône bureau visible
- [ ] Bandeau bas (Achats / Rechargement / Config / Base / Fouaille) visible en bas d'écran
- [ ] Scan carte test → membre chargé, solde affiché, panier fonctionnel
- [ ] Watchdog actif (`pgrep -f watchdog.sh`)
- [ ] Boot script en place (`~/.termux/boot/marco.sh`)

---

## 🤝 Crédits & Licence

Projet original : **Marco Prime** — Caisse tactile RFID pour événements scolaires  
Auteurs : Enzo Campofranco & Romain Bourdinho  
Cette version portable : adaptations tablette Lenovo TB-X605F (Android 9, Termux, Bromite)  
Licence : voir `LICENSE` du repo original (`Marco-Prime`)

---

## 📞 Support / Dépannage rapide

| Symptôme | Action |
|----------|--------|
| Serveur ne répond pas | `pgrep -f "node dist/index.js"` → absent → `./marco-prime-backend/dist/index.js &` |
| Bandeau bas disparu | Recharger la page (`location.reload()` via CDP ou rouvrir l'app) |
| Clavier natif ne s'ouvre pas | Vérifier `inputMode` non forcé à `none` dans `member-search.tsx` |
| Scan RFID ignoré | Lecteur en mode clavier ? `lsusb` → `dmesg` → test `cat /dev/hidrawX` |
| PWA ne s'installe pas | `sw.js` accessible ? `curl http://localhost:3001/sw.js` → 200 + `navigator.serviceWorker.register()` |
| Build frontend échoue | `cd marco-prime-frontend && pnpm run build` → lire `build.log` |

---

> **Note** : Ce dossier `/Users/enzocampofranco/Desktop/Marco-Prime-Portable` contient **tout le nécessaire** pour reproduire l'environnement tablette. Il n'y a **pas de secrets** (pas de `.env`, pas de base prod). Pour déployer : copier `marco-tablet/` sur la tablette (Termux home), `pnpm install && ./build-front.sh`, configurer le boot script, tester.