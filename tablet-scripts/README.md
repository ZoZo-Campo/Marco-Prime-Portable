# tablet-scripts

Scripts et réglages **Termux** de la tablette Marco Prime. Contenu :

```
tablet-scripts/
├── install.sh              # copie home/ -> ~ (scripts + dotfiles), règle les droits
├── setup-ssh.sh            # active l'accès SSH distant (port 8022, clé publique)
└── home/                   # MIRROIR du home Termux (~)
    ├── build-front.sh          # build front + injection PWA -> backend/public
    ├── rebuild.sh              # compile backend + build front
    ├── relance-marco.sh        # démarre serveur + watchdog (--force pour redémarrer)
    ├── stop-marco.sh           # arrêt propre (stoppe le watchdog puis le serveur)
    ├── watchdog.sh             # relance le serveur s'il tombe (boucle 15 s)
    ├── relance.html            # page "Relancer le serveur" (via intent Termux)
    ├── .bashrc / .profile      # relance auto à l'ouverture d'une session Termux
    ├── .termux/termux.properties   # allow-external-apps
    ├── .termux/boot/marco.sh   # autostart au démarrage de la tablette
    ├── .shortcuts/relance.sh   # raccourci Termux "Relance Marco"
    └── .shortcuts/stop.sh      # raccourci Termux "Arrêter Marco"
```

## Utilisation (sur la tablette)

```bash
# 1) installer scripts + dotfiles dans ~
cd <dossier>/tablet-scripts && sh install.sh

# 2) (optionnel) accès SSH distant
sh setup-ssh.sh "ssh-ed25519 AAAA...lenzocampofranco"
```

Voir **../INSTALLATION_TABLETTE.md** pour la procédure complète.
