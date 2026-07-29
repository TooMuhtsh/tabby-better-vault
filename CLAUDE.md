# tabby-better-vault

Plugin pour [Tabby](https://tabby.sh) : déverrouillage automatique du
coffre-fort (mot de passe maître) via le keychain natif de l'OS
(`safeStorage` — DPAPI sur Windows, Trousseau sur macOS, Secret Service sur
Linux), sans dépendre d'un gestionnaire de mots de passe tiers.

Dépôt distant : https://github.com/TooMuhtsh/tabby-better-vault

**Avant toute session de travail sur ce projet, lire `.AIRules/README.html`**
(index + protocole), puis `.AIRules/AI-CONTEXT.html` (invariants et pièges
numérotés `#V1`–`#V18`, plus les pièges hérités du projet frère) et
`.AIRules/AI-HISTORY.html`/`.AIRules/ROADMAP.html` pour l'état d'avancement.
Ouvrir ces fichiers directement dans un navigateur.

## Le point à comprendre en premier

**Tabby n'expose aucune API pour injecter le mot de passe maître.** Le cache
est une variable de portée module (`_rememberedPassphrase`), délibérément
rendue inaccessible. Ce plugin remplace donc `VaultService.getPassphrase` sur
l'instance obtenue via l'injecteur Angular — un mécanisme **non contractuel**,
à revérifier à chaque mise à jour de Tabby (`.AIRules/AI-CONTEXT.html`, #V2).

## Build

```
npm install --ignore-scripts
npm run build                  # ou npm run watch
```

Tester : jonction NTFS vers `%APPDATA%\tabby\plugins\node_modules\tabby-better-vault`
(la variable `TABBY_PLUGINS` est structurellement cassée sur Windows, #V9),
puis relancer entièrement `Tabby.exe` — un rechargement de fenêtre ne suffit pas.

## Conventions de code

- **Ne jamais mettre de réglage dans `config.yaml`** (pas de `ConfigProvider`).
  Quand l'utilisateur chiffre sa config, tout sauf `vault`/`encrypted`/`configSync`
  est dans le blob chiffré — or c'est précisément là que le plugin doit agir.
  L'état vit dans `%APPDATA%\tabby\better-vault.json` (`src/store.ts`, #V11).
  Ce fichier ne doit jamais devenir synchronisable : la sync de config de Tabby
  provoquerait une destruction mutuelle du jeton entre machines.
- **Ne jamais appeler `vault.decrypt()`/`vault.load()` depuis le pont** : les
  deux retombent sur `getPassphrase()`, donc sur notre propre fonction —
  récursion infinie au démarrage. D'où la réplication du déchiffrement dans
  `src/vaultCrypto.ts` (#V10).
- **Le mot de passe en clair ne survit à aucun appel** : jamais dans un champ
  d'objet, jamais en cache, jamais journalisé (sa longueur non plus), jamais
  écrit ailleurs que chiffré par l'OS. Règle non négociable, voir
  `.AIRules/ROADMAP.html`.
- **Toujours retomber sur la méthode native** à la moindre anomalie (jeton
  périmé, keychain indisponible, mot de passe maître changé). Ce plugin est un
  confort : il ne doit jamais empêcher d'ouvrir son coffre ni bloquer Tabby.
- Composants Angular : `template: require('./x.pug')`, jamais `templateUrl`
  (piège hérité #3). Styles en import side-effect, portés par une classe racine
  et non par `:host`, sans effet ici (piège hérité #14).
- **Un SCSS importé par un composant n'est chargé que si ce composant est
  instancié** — tout style visant l'extérieur du composant (ex. les
  notifications) doit être importé depuis `src/index.ts` (#V12).
- Versions verrouillées pour Angular 15 : `typescript@^4.9`, `pug@^2.0`,
  `@types/node@^18.19`. `ngx-toastr` doit rester **external** (Tabby le
  pré-cache et sert sa propre instance, #V8) ; il n'est en devDependency que
  pour ses typages.

## Git

Identité configurée **localement** pour ce dépôt (pas globalement) :
`TooMuhtsh <188712716+TooMuhtsh@users.noreply.github.com>`. Ne pas committer
avec une autre adresse sans confirmation explicite.
