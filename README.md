# tabby-better-vault

Plugin pour [Tabby](https://tabby.sh) (terminal SSH/SFTP) : déverrouillage automatique du
coffre-fort (mot de passe maître) via délégation à l'OS (`electron.safeStorage` — Gestionnaire
d'identifiants/DPAPI sur Windows, Trousseau d'accès/Keychain sur macOS, Secret Service/`libsecret`
sur Linux) plutôt que de stocker le mot de passe en clair.

Projet frère de [tabby-better-sidebar](https://github.com/TooMuhtsh/tabby-better-sidebar) —
indépendant, interfaçage optionnel entre les deux (voir `.AIRules/`).

## Positionnement

Il existe déjà [`tabby-vault-keepassxc`](https://github.com/chomoe327/tabby-vault-keepassxc), qui
déverrouille le coffre-fort via KeePassXC. La différence tient en une phrase : **ce plugin ne
demande aucun gestionnaire de mots de passe tiers** — il s'appuie uniquement sur le keychain natif
déjà présent sur la machine.

## Statut

**Prototype de vérification (« spike ») — pas encore utilisable.** Le plugin actuel se contente
d'*observer* : il journalise le déroulement du déverrouillage sans jamais s'y substituer, afin de
lever deux incertitudes techniques (le moment exact où Tabby réclame le mot de passe, et la
possibilité pour un plugin tiers d'atteindre le keychain de l'OS). Aucun déverrouillage automatique
n'est encore implémenté.

À noter dès maintenant : Tabby n'expose aucune API d'injection du mot de passe maître. Ce plugin
repose donc sur un mécanisme non officiel (remplacement d'une méthode interne), au même titre que
l'alternative KeePassXC citée plus haut.

Voir [`.AIRules/README.html`](.AIRules/README.html) pour la gouvernance complète du projet
(contexte, historique, roadmap) — à ouvrir directement dans un navigateur.

## Développement

```
npm install --ignore-scripts
npm run build          # ou npm run watch
```

Pour tester dans Tabby, créer une jonction NTFS (la variable d'environnement `TABBY_PLUGINS` est
cassée sur Windows) :

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-vault" -Target "<ce dossier>"
```

Puis relancer entièrement `Tabby.exe` — un simple rechargement de fenêtre ne suffit pas.

## Licence

MIT — voir [LICENSE](LICENSE).
