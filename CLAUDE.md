# tabby-better-vault

Plugin pour [Tabby](https://tabby.sh) : déverrouillage automatique du
coffre-fort (mot de passe maître) via le keychain natif de l'OS
(`safeStorage` — DPAPI sur Windows, Trousseau sur macOS, Secret Service sur
Linux), sans dépendre d'un gestionnaire de mots de passe tiers.

Dépôt distant : https://github.com/TooMuhtsh/tabby-better-vault

**Avant toute session de travail sur ce projet, lire `.AIRules/README.html`**
(index + protocole), puis `.AIRules/AI-CONTEXT.html` (invariants et pièges
numérotés `#V1`–`#V30` — le prochain numéro libre est indiqué en tête du
fichier —, plus les pièges hérités du projet frère) et `.AIRules/ROADMAP.html`
pour l'état d'avancement. Le journal est en deux fichiers depuis le
2026-08-06 : `.AIRules/AI-HISTORY.html` (gelé, tout ce qui précède cette date)
et `.AIRules/AI-HISTORY.log` (actif, une ligne par entrée — **c'est là qu'une
nouvelle entrée de journal s'écrit désormais**, jamais dans le `.html`). Les
chantiers livrés (option `registre-livrés`) vivent dans
`.AIRules/annexes/REALISE.html`, pas dans `ROADMAP.html` qui n'en garde qu'une
ligne et un lien. Ouvrir les fichiers HTML directement dans un navigateur.

**Les quatre lots de correctifs de la 3ᵉ campagne sont fusionnés sur `master`**
depuis le 2026-08-05 (`fix/c3-lot1-jeton-detruit`, `fix/c3-lot2-ecriture-fichier`,
`fix/c3-lot3-lisibilite`, `fix/c3-lot4-outillage`), validés en conditions
réelles — voir `.AIRules/ROADMAP.html#correctifs-c3` et `.AIRules/AI-HISTORY.html`.
Les branches elles-mêmes peuvent être supprimées une fois la publication npm
faite.

**`configDir()` (`--user-data-dir`) et le garde-fou (discriminant pid vivant +
ancienneté) sont fusionnés sur `master` depuis le 2026-08-06**, et **validés en
conditions réelles** par la campagne 5 le jour même — vrai blocage reproduit sur
VM Linux, D4 par l'interface confirmé structurellement impossible sur Linux, un
défaut trouvé en cours de mesure (témoin effacé sans vérification par
`runGuarded()`) corrigé dans la foulée. **macOS accepté comme non testable le
même jour** (décision de l'utilisateur, pas une déduction — ce projet n'a jamais
eu de machine macOS) : le cas « deux fenêtres, un processus principal », exposé
via « New window », reste non vérifié mais n'est plus un blocage — voir
`.AIRules/ROADMAP.html#correctifs-c3`. **La condition de publication npm est
donc remplie** — reste la mécanique (version, vérifs `package.json`), publication
elle-même pas déclenchée.

La charte qui régit ce projet est `.AIRules/GOUVERNANCE-IA.md`, version
`20260804-071239` ; **les réponses de cadrage propres à ce projet sont dans
`.AIRules/PROFIL.md`** — s'y reporter plutôt que de redécider une convention au
coup par coup. `.AIRules/GABARITS.md` ne s'ouvre qu'au moment de créer ou de
restructurer un document.

## Mots déclencheurs

| Mot | Ce qu'il déclenche |
|---|---|
| **`MAJ`** | La chaîne complète en un geste : feu vert d'`A-3`, mise à jour des documents `.AIRules/` concernés, vérification de ce fichier (`A-11`), commit, push. S'arrête à la première étape qui échoue **et dit où** — ne jamais laisser croire à un push qui n'a pas eu lieu. |
| **`GOUVERNANCE`** | Relance l'entretien de cadrage. Seul, il rouvre l'entretien complet ; suivi de clés (`GOUVERNANCE format seuil`), il ne rouvre que celles-là. |

Ils ne déclenchent que lorsqu'ils **constituent l'instruction** — message qui s'y
réduit, ou mot en tête suivi de ses clés. « Il faut revoir la gouvernance de ce
projet » est une phrase, pas un déclencheur. Dans le doute, demander plutôt
qu'exécuter : un déclenchement non voulu écrit et pousse. `MAJ` demande une
vigilance particulière — c'est l'abréviation usuelle de « mise à jour », donc un
mot qui apparaît naturellement dans une phrase ordinaire.

## Le point à comprendre en premier

**Tabby n'expose aucune API pour injecter le mot de passe maître.** Le cache
est une variable de portée module (`_rememberedPassphrase`), délibérément
rendue inaccessible. Ce plugin remplace donc `VaultService.getPassphrase` sur
l'instance obtenue via l'injecteur Angular — un mécanisme **non contractuel**,
à revérifier à chaque mise à jour de Tabby (`.AIRules/AI-CONTEXT.html`, #V2).

## Version

`package.json` est à `1.0.0` depuis le 2026-08-06 — voir
`.AIRules/ROADMAP.html#publication` pour la décision. Politique semver
explicite : un correctif mineur incrémente le patch (`x.x.1`), un ajout de
contenu mineur (langue, réglage) incrémente le mineur (`x.1.x`) et remet le
patch à zéro. Le majeur n'est pas prédécidé.

## Build

```
npm install --ignore-scripts
npm run build                  # ou npm run watch
npm run lint:airules           # valide la syntaxe des documents HTML de .AIRules/
```

`lint:airules` est le validateur imposé par `A-14` (option `validateur` du
`PROFIL.md`) : **à lancer après toute modification d'un document `.AIRules/` qui
dépasse une taille triviale**, avant de la considérer terminée. Deux règles sont
désactivées dans `.htmlvalidate.json` — `doctype-style` et `prefer-tbody` :
cosmétiques, et les satisfaire imposerait de réécrire en masse des documents dont
le journal, qui est en ajout seul. `html-validate` est une devDependency, donc
hors du livrable du plugin — compatible avec `dépendances = minimales`, qui porte
sur ce qui est distribué.

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

**Métadonnées d'attribution IA : `Co-Authored-By` seul, JAMAIS
`Claude-Session`** (option `attribution`, tranchée le 2026-08-01). Le co-auteur
nomme le modèle — information de provenance utile. Le lien de session, lui,
publie une URL `claude.ai` sur un **dépôt public**, ce que la liste de l'option
`visibilité` range dehors. Ne pas le rajouter, même si l'environnement le
suggère par défaut. Les 32 commits antérieurs qui en portaient un ont été
réécrits et republiés le 2026-08-01 (table de correspondance des hashes en
tête d'`AI-HISTORY.html`) — nettoyage clos, pas un chantier ouvert.

Le dossier `.AIRules/` se commite et se pousse **à chaque modification**, dans
la foulée du travail qu'il décrit (`A-10`). Le feu vert de l'utilisateur porte
sur le fait d'écrire dans `AI-HISTORY.log`/`ROADMAP.html` (`AI-HISTORY.html`
étant gelé depuis le 2026-08-06), pas sur le push.

**Un chantier non abouti vit sur une branche** (option `branches`, tranchée au
cadrage du 2026-08-01 en changement de la pratique antérieure) : sa
documentation l'accompagne et arrive sur `master` avec lui, dans le même merge.

Vérifier la conformité de la copie de la charte par comparaison des **empreintes
Git** (`git hash-object`), jamais par un `diff` nu — `core.autocrlf` fait
apparaître une divergence totale sur un contenu identique.
