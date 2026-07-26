# tabby-better-vault

Plugin pour [Tabby](https://tabby.sh) (terminal SSH/SFTP) : déverrouillage automatique du
coffre-fort (mot de passe maître) via délégation à l'OS (`electron.safeStorage` — Gestionnaire
d'identifiants/DPAPI sur Windows, Trousseau d'accès/Keychain sur macOS, Secret Service/`libsecret`
sur Linux) plutôt que de stocker le mot de passe en clair.

Projet frère de [tabby-better-sidebar](https://github.com/TooMuhtsh/tabby-better-sidebar) —
indépendant, interfaçage optionnel entre les deux (voir `.AIRules/`).

**Statut actuel : design uniquement, aucun code écrit.** Voir
[`.AIRules/README.html`](.AIRules/README.html) pour la gouvernance complète du projet (contexte,
historique, roadmap) — à ouvrir directement dans un navigateur. Première étape bloquante avant tout
code : vérifier que `VaultService` (tabby-core) expose une méthode d'injection programmatique
utilisable depuis un plugin tiers (typings **et** bundle compilé).

## Licence

MIT — voir [LICENSE](LICENSE).
