# Installation — tablette Marco Prime (Termux / Android)

Ce document permet de **refaire une tablette Marco Prime à l'identique** (2ᵉ caisse) :
application, scripts, réglages Termux, accès SSH et auto-démarrage.

Tablette de référence : **Lenovo TB-X605F**, Android 9, Termux. Toute tablette Android ≥ 7
faisant tourner Termux convient.

---

## 1. Prérequis

**Hardware**
- Tablette Android + lecteur **RFID USB** (mode clavier/HID) et câble **OTG**.
- Accès réseau permettant de joindre la base MySQL (voir §6, `.env`).

**Applications à installer sur la tablette** (via **F-Droid**) :
- **Termux** (`com.termux`)
- **Termux:Boot** (`com.termux.boot`) — auto-démarrage au boot
- **Termux:API** (`com.termux.api`) — pour `termux-wake-lock`
- **Termux:Widget** (`com.termux.widget`) — raccourcis bureau (relance / arrêt)
- **Bromite** (`org.bromite.bromite`, navigateur Chromium, hors Play Store)

**Sur le poste de travail** : `adb` (Android platform-tools) et/ou `ssh`.

---

## 2. Arborescence cible sur la tablette

```
~/marco-tablet/                 # l'application (ce dossier, copié tel quel)
~/build-front.sh                # build front + PWA + copie vers backend/public
~/rebuild.sh                    # compile backend + build front
~/relance-marco.sh              # démarre serveur + watchdog
~/stop-marco.sh                 # arrêt propre (stoppe le watchdog puis le serveur)
~/watchdog.sh                   # relance le serveur s'il tombe
~/relance.html                  # page "Relancer le serveur"
~/.bashrc  ~/.profile           # relance auto à l'ouverture d'une session Termux
~/.termux/termux.properties     # allow-external-apps
~/.termux/boot/marco.sh         # autostart au démarrage de la tablette
~/.shortcuts/relance.sh         # raccourci "Relance Marco" (Termux:Widget)
~/.shortcuts/stop.sh            # raccourci "Arrêter Marco" (Termux:Widget)
```

Le dossier `tablet-scripts/` de ce projet contient **tout le contenu ci-dessus**
(`install.sh` fait la copie vers `~`).

---

## 3. Termux : paquets de base

```bash
termux-setup-storage        # autorise l'accès au stockage (/sdcard)
pkg update && pkg upgrade -y
pkg install -y nodejs openssh
corepack enable pnpm || npm install -g pnpm
```

---

## 4. Copier les fichiers sur la tablette

Depuis le Mac (une fois `adb` connecté à la tablette) :

```bash
adb push marco-tablet    /sdcard/
adb push tablet-scripts  /sdcard/
```

Puis, dans Termux :

```bash
cp -r /sdcard/marco-tablet   ~/marco-tablet
cp -r /sdcard/tablet-scripts ~/tablet-scripts
cd ~/tablet-scripts && sh install.sh
```

`install.sh` copie les scripts et dotfiles dans `~`, met les bons droits et règle
`chmod 700 ~` (nécessaire pour sshd).

> Une fois le SSH en place (§7), les mises à jour suivantes se font directement en `scp`/`rsync`.

---

## 5. Dépendances et build

```bash
# Backend
cd ~/marco-tablet/marco-prime-backend
pnpm install
pnpm build                        # compile TypeScript -> dist/

# Frontend
cd ~/marco-tablet/marco-prime-frontend
pnpm install

# Build front + injection PWA + copie vers backend/public
cd ~ && sh build-front.sh
```

Puis démarrer le serveur (et le watchdog) :

```bash
sh ~/relance-marco.sh
```

Le serveur écoute sur **`http://127.0.0.1:3001`** (`API_PORT=3001` dans le `.env`).

---

## 6. Configuration `.env` (backend)

Le fichier `~/marco-tablet/marco-prime-backend/.env` doit contenir les valeurs fournies
par l'administratrice. Ne jamais publier les identifiants réels dans Git :

```env
API_AUTH_ENABLED=false
API_TOKEN=
DATABASE_URL=mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:PORT/NOM_DE_LA_BASE
FOUAILLE_API_URL=https://fouaille.bde-tps.fr/api/product
FOUAILLE_SYNC_ENABLED=false
FOUAILLE_SYNC_INTERVAL_MS=300000
MARCO_DATA_DIR=/data/data/com.termux/files/home/marco-tablet/data
API_PORT=3001
MARCO_HOST_PORT=3001
NODE_ENV=production
FRONTEND_URL=http://127.0.0.1:3001
```

> La base est **MySQL distante** (`bde.its-tps.fr:3307`). La tablette doit pouvoir l'atteindre
> sur le réseau. Seule la **sélection catalogue** (`marco-tablet/data/catalog-selection.json`)
> est locale. Le frontend n'a pas besoin de `.env` (il appelle `/api/v1` en relatif).

---

## 7. Accès SSH distant (recommandé)

Sur la tablette :

```bash
# Remplacer par la clé publique du poste depuis lequel on se connecte
sh ~/tablet-scripts/setup-ssh.sh "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDt86QeubSZVLrMDJ+e6wZDDf1FuwAMeKnudkEjbTKod enzocampofranco"
```

Le script : installe `~/.ssh/authorized_keys`, met les droits (StrictModes), force le
**port 8022** et démarre `sshd`. L'auto-démarrage de `sshd` est déjà inclus dans
`~/.termux/boot/marco.sh`.

Sur le Mac, ajouter dans `~/.ssh/config` :

```
Host marco
    HostName <IP_DE_LA_TABLETTE>
    Port 8022
    User <utilisateur_termux>          # ex. u0_a126 (change à chaque réinstallation)
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 30
```

Connexion : `ssh marco`.

> **Dépannage** : si sshd refuse la clé (`bad ownership or modes for directory .../home`),
> lancer `chmod 700 /data/data/com.termux/files/home`. Ne **jamais** faire `pkill -f sshd`
> (tue aussi son propre shell) — utiliser `pkill -x sshd`.

---

## 8. Auto-démarrage

1. **Termux:Boot** : ouvrir l'application une fois pour l'enregistrer auprès d'Android.
   `~/.termux/boot/marco.sh` sera exécuté à chaque démarrage de la tablette.
2. **Auto-relance à l'ouverture de Termux** : déjà placé dans `~/.bashrc` et `~/.profile`
   par `install.sh`.
3. `~/.termux/termux.properties` contient `allow-external-apps=true` (requis pour la page
   de relance et le raccourci). Relancer l'appli Termux après modification.

---

## 9. Mode kiosque / PWA

- Ouvrir `http://127.0.0.1:3001/buy` dans Bromite → ☰ → **Installer l'application**.
- Icône « Marco » ajoutée à l'écran d'accueil → lance l'app en plein écran (paysage).
- Verrouiller la rotation en paysage (Paramètres Android).
- Écran : `~/.termux/boot/marco.sh` désactive la veille
  (`screen_off_timeout=2147483647`, `stay_on_while_plugged_in=7`) et force le mode immersif
  pour Bromite.

> L'ouvreur PWA (`WebappActivity`) n'est **pas exportée** : l'app ne se lance **que** par un
> tap sur l'icône « Marco ». `am start` ne fonctionne pas.

---

## 10. Vérifications

```bash
pgrep -f "node dist/index.js"        # serveur actif ?
pgrep -f watchdog.sh                 # watchdog actif ?
pgrep -x sshd                        # sshd actif ?
curl -s http://127.0.0.1:3001/api/v1/system/status   # réponse de l'API
```

---

## 11. Dépannage rapide

| Symptôme | Action |
|----------|--------|
| Serveur absent | `sh ~/relance-marco.sh --force` |
| Bandeau rouge « Base » dans l'appli | Réseau MySQL indisponible → vérifier le réseau, puis `sh ~/relance-marco.sh` |
| Frontend pas à jour | `sh ~/build-front.sh` puis recharger l'app |
| `cp ... public/: No such file` | `build-front.sh` crée désormais `public/` automatiquement |
| SSH « permission denied » | Vérifier `~/.ssh/authorized_keys` (600), `~/.ssh` (700), `~` (700) |
| `adb shell` bloqué | `adb kill-server && adb start-server` |
| Capture d'écran | `adb shell screencap -p /sdcard/shot.png` puis `adb pull /sdcard/shot.png` |

---

## 12. Référence tablette (modèle)

| Champ | Valeur |
|-------|--------|
| Modèle | Lenovo TB-X605F (Android 9) |
| Utilisateur Termux | `u0_a126` (change à chaque réinstallation — voir `id -un` dans Termux) |
| IP locale | `192.168.1.26` |
| SSH | port `8022` |
| API | `http://127.0.0.1:3001` |

---

## 13. Debloat (Lenovo + Google)

Ces applis ne servent pas au kiosque et génèrent des popups/notifications. Elles sont
retirées en `--user 0` (réversible : `adb shell pm install-existing <pkg>`).

**Lenovo / région / enfants**

```
com.kidoz.lenovo
com.wantjoin.safeBrowser
com.android.wantjoin.settings        # dialog "Configurer un nouvel utilisateur"
com.android.wantjoin.childmode.ctrl
com.tblenovo.lenovotips
com.tblenovo.whatsnewclient
com.tblenovo.whatsnewhost
com.tblenovo.setup                   # assistant d'installation
```

**Google — à NE PAS purger** : le **Play Store** et les autres applis Google (YouTube,
Gmail, Maps, Photos, Calendrier, Docs, Duo, Bien-être, Fichiers…) sont **conservés**.

```bash
# purge des seules applis Lenovo (liste ci-dessus)
for p in com.kidoz.lenovo com.wantjoin.safeBrowser com.android.wantjoin.settings \
         com.android.wantjoin.childmode.ctrl com.tblenovo.lenovotips \
         com.tblenovo.whatsnewclient com.tblenovo.whatsnewhost com.tblenovo.setup ; do
  adb shell pm uninstall --user 0 "$p"
done
```

> ⚠️ `pm uninstall` **échoue depuis Termux** (pas de permission) : à lancer via `adb`.
> `~/.termux/boot/marco.sh` ne tente donc plus de purge (ça polluait le log).
> Pour **remettre** une appli retirée : `adb shell pm install-existing <pkg>` (lent, ~5 s).

---

## 14. Remise à zéro / réinstallation

- **Réinitialiser la tablette** : flash complet via **Lenovo Rescue & Smart Assistant
  (LMSA, Windows)** — le firmware TB-X605F n'est pas publié librement. Après flash :
  Android 9 neuf, **nouvel uid Termux** (`u0_a126` ici), même IP locale ; penser à mettre
  à jour `~/.ssh/config` (`User u0_a126`).
- **Injecter des commandes dans Termux** (le build F-Droid de Termux **n'est pas
  débogable** : `run-as com.termux` échoue, `RUN_COMMAND` est refusé au shell) :
  ```bash
  adb shell input text "bash%s/sdcard/Marco/setup1.sh"   # %s = espace
  adb shell input keyevent 66                            # Entrée
  ```
  Prérequis : écran **allumé** et Termux **au premier plan** (sinon la frappe part au
  keyguard). Pendant `pkg upgrade`, un prompt dpkg peut bloquer → envoyer `Entrée`, ou
  utiliser `DEBIAN_FRONTEND=noninteractive`.
- **Une fois le SSH en place**, tout se fait en `ssh marco` / `scp` (bien plus fiable que
  l'injection `input text`).
