# Marco Prime — Caisse tablette (portable)

Version **portable** de Marco Prime (caisse tactile RFID) qui tourne **en local sur une
tablette Android** sous Termux, **sans Raspberry Pi et sans Docker**. Le navigateur affiche
l'appli en plein écran (PWA) et un serveur Node sert l'API + le frontend sur la tablette.

Tablette de référence : **Lenovo TB-X605F** (Android 9).

> Installation d'une nouvelle tablette : voir **[INSTALLATION_TABLETTE.md](INSTALLATION_TABLETTE.md)**.

---

## Contenu du projet

```
Marco-Prime-Portable/
├── marco-tablet/
│   ├── marco-prime-frontend/   # Preact + TypeScript + Vite + Tailwind (UI)
│   ├── marco-prime-backend/    # Node.js + Hono + Drizzle + MySQL (API REST)
│   │   └── .env                # configuration locale (non versionnée)
│   ├── frontend-pwa/           # manifest.json, sw.js, icônes
│   └── data/                   # catalog-selection.json (sélection locale du soir)
├── tablet-scripts/             # scripts + réglages Termux (voir son README.md)
└── INSTALLATION_TABLETTE.md    # procédure complète de (re)installation
```

`marco-tablet/` se copie tel quel dans `~/marco-tablet/` sur la tablette ; `tablet-scripts/`
installe les scripts et dotfiles dans `~`.

---

## Démarrage rapide (tablette)

```bash
# 1) dépendances + build
cd ~/marco-tablet/marco-prime-backend  && pnpm install && pnpm build
cd ~/marco-tablet/marco-prime-frontend && pnpm install
cd ~ && sh build-front.sh              # build front + PWA -> backend/public

# 2) lancer (serveur + watchdog)
sh ~/relance-marco.sh

# 3) ouvrir l'appli
#    Bromite -> http://127.0.0.1:3001/buy  -> installer la PWA (icône "Marco")
```

Détails (Termux, SSH, auto-démarrage, kiosque) : **INSTALLATION_TABLETTE.md**.

---

## Architecture

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Frontend** | Preact + TypeScript + Vite + Tailwind | UI tactile : panier, membres, scan RFID, admin |
| **Backend** | Node.js + **Hono** + Zod + Drizzle ORM | API REST, transactions |
| **Base** | **MySQL distante** (`bde.its-tps.fr:3307`) | Membres, produits, ventes, stats, recharges |
| **PWA** | manifest + service worker | Appli installable plein écran (le SW ne met **rien** en cache) |
| **Scan RFID** | Lecteur USB (mode clavier/HID) | Détection rapide → commit automatique |

### Flux principal
1. **Scan carte RFID** → buffer clavier → `GET /api/v1/member/:cardNumber`
2. **Membre chargé** → solde affiché, panier déverrouillé (refus si solde négatif)
3. **Ajout produits** → feedback visuel + son
4. **Paiement** → `POST /api/v1/purchase` (transaction) → solde + historique (débit immédiat)
5. **Rechargement** → carte admin + montant → `POST /api/v1/recharge`

### Routes principales (API, préfixe `/api/v1`)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` / `/ready` | Santé du serveur (hors `/api/v1`) |
| GET | `/system/status` | Santé du serveur, base et Fouaille |
| POST | `/system/env/status` | État masqué du `.env` (admin) |
| POST | `/system/env/validate` | Vérifie un `.env` et teste MySQL (admin) |
| POST | `/system/env` | Importe le `.env`, crée une sauvegarde et redémarre (admin) |
| GET | `/member-promotions` | Promotions (filtre recherche) |
| GET | `/member/:card_number` | Membre par n° de carte |
| POST | `/members/search` | Recherche nom / prénom / promo / carte |
| POST | `/purchase` | Valide un panier (transaction) |
| POST | `/recharge` | Recharge de solde (carte admin) |
| POST | `/statistics` | Recettes, coûts et bénéfice sur une période |
| POST | `/accounting` | Lire la compta réelle locale |
| PUT | `/accounting` | Enregistrer la compta réelle locale |
| POST | `/accounting/export` | Export complet d’une soirée (ventes + recharges + compta) |

**Compta réelle** : la période de la soirée se règle par date + heures de début
et de fin (défaut 17 h → 23 h 59, fin le lendemain si l'heure de fin précède le
début). Le préremplissage des recettes utilise cette période. L'export des
rechargements possède sa **propre plage libre date + heure** (« Du … au … »),
avec les raccourcis « Soirée » (période de la compta) et « Journée »
(00 h 00 → 23 h 59). Les dates sont affichées au format français `jj-mm-yyyy`.

**Contrôle de cotisation** : la fiche membre expose `contributor` (colonne
`members.contributor`). Si un membre scanné n'a pas cotisé, un encart rouge
« Ce membre n'a pas cotisé » s'affiche et une boîte de dialogue demande
« Voulez-vous vraiment servir ? ». « Non » efface la carte ; « Oui » autorise
exceptionnellement la vente pour cette carte.

Documentation API détaillée : `marco-tablet/marco-prime-backend/README.md`.

---

## Automatisation (tablette)

| Élément | Rôle |
|---------|------|
| `~/.termux/boot/marco.sh` | Au boot : écran toujours allumé, mode immersif, serveur + watchdog, build en fond, `sshd` |
| `~/watchdog.sh` | Relance le serveur (boucle 15 s) s'il tombe |
| `~/relance-marco.sh` | Démarre serveur + watchdog (`--force` = redémarre le serveur) |
| `~/build-front.sh` | Build front + injection PWA + copie vers `backend/public` |
| `~/rebuild.sh` | Compile le backend **et** rebuild le frontend |
| `~/.bashrc` / `~/.profile` | Relance le serveur à l'ouverture d'une session Termux |
| `~/.shortcuts/relance.sh` | Raccourci Termux « Relance Marco » |

> **Pas de mise à jour automatique depuis GitHub.** Au démarrage, `marco.sh` lance
> uniquement le serveur et le watchdog sur le code déjà présent dans
> `~/marco-tablet`. Aucun `git pull` n'est exécuté au boot.

### Mettre à jour Marco

La mise à jour est **manuelle**, depuis le Mac de développement :

```bash
# 1) publier les changements
git push

# 2) copier les sources sur la tablette (tar ou rsync), puis sur la tablette :
sh ~/rebuild.sh              # compile le backend + rebuild le frontend
sh ~/relance-marco.sh --force # redémarre le serveur
```

Recharger ensuite l'application (bouton « Recharger l'application » dans
Configuration, ou relance de la PWA). Le service worker ne met rien en cache :
les assets hachés sont servis dès le rechargement.

---

## Points d'attention

| Sujet | Détail |
|-------|--------|
| **Base MySQL distante** | Nécessite un réseau joignant `bde.its-tps.fr:3307`. Pas de base locale. |
| **Pas de root** | `su` indisponible ; les opérations fichiers passent par `run-as com.termux`. |
| **PWA non lançable par intent** | `WebappActivity` non exportée → l'app se lance par tap sur l'icône « Marco ». |
| **Service worker** | No-op (aucun cache). Une nouvelle version est servie au rechargement (assets hachés). |
| **`adb shell` instable** | En cas de blocage : `adb kill-server && adb start-server` ; capture via `screencap` fichier. |

---

## Dépannage

| Symptôme | Action |
|----------|--------|
| Serveur ne répond pas | `sh ~/relance-marco.sh --force` |
| Frontend pas à jour | `sh ~/build-front.sh` puis recharger |
| Build échoue | Lire `marco-prime-frontend/build.log` / `marco-prime-backend/build-back.log` |
| Logs serveur | `marco-prime-backend/server.log` |

---

## Crédits & licence

Projet original **Marco Prime** — caisse tactile RFID pour événements scolaires.
Auteurs : Enzo Campofranco & Romain Bourdinho.
Licence : voir `marco-tablet/marco-prime-backend/LICENSE`.
