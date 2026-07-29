# tabby-better-vault

[English](README.md) · **Français**

Déverrouillez automatiquement le coffre-fort de [Tabby](https://tabby.sh) grâce
au trousseau de votre système d'exploitation — sans aucun gestionnaire de mots
de passe tiers.

Le coffre-fort de Tabby protège vos mots de passe et vos clés privées derrière
un mot de passe maître. Si vous activez en plus le chiffrement de la
configuration, ce mot de passe est réclamé **à chaque démarrage**. Ce plugin le
confie une fois au trousseau du système, puis répond à votre place.

> **État : fonctionnel, mais pas encore publié sur npm.** Installation depuis
> les sources (voir plus bas). Ce plugin s'appuie sur une partie non documentée
> de Tabby — voir [Fonctionnement](#fonctionnement).

## Fonctionnalités

- [x] **Déverrouillage automatique** via le trousseau du système — gestionnaire
      d'identifiants de Windows (DPAPI), trousseau de macOS, Secret Service
      sous Linux
- [x] **Compatible avec la configuration chiffrée**, le cas où le mot de passe
      serait autrement demandé à chaque démarrage
- [x] **Expiration configurable** — créneau hebdomadaire fixe (par défaut le
      lundi à 3 h), délai glissant, ou jamais
- [x] **Réglages par machine** — actif sur le poste fixe, inactif sur le
      portable ; chaque machine garde sa propre politique
- [x] **Révocation à tout moment** depuis l'onglet de réglages
- [x] **Notification lors de l'enregistrement**, indiquant où le mot de passe
      est stocké, jusqu'à quand, et comment le révoquer
- [x] **Journal d'audit** des ouvertures du coffre, des expirations et des
      révocations, avec durée de conservation configurable — ne contenant
      jamais le mot de passe
- [x] **Mode observation** — voir ce que ferait le plugin sans le laisser rien
      enregistrer
- [x] **Repli sûr** — en cas d'anomalie, retour silencieux à la fenêtre native
      de Tabby ; le plugin ne bloque jamais l'accès au coffre-fort
- [ ] Publication sur npm, installable depuis le gestionnaire de plugins
- [x] Vérification sous Linux, dont le refus du backend `basic_text`
- [ ] Panneau de réglages commun aux autres plugins `tabby-better-*`

## Installation

Pas encore publié : à compiler depuis les sources.

```bash
git clone https://github.com/TooMuhtsh/tabby-better-vault
cd tabby-better-vault
npm install --ignore-scripts
npm run build
```

Puis, Tabby fermé, lier le dossier au répertoire de plugins de Tabby :

```powershell
# Windows — ne pas utiliser la variable TABBY_PLUGINS, elle est cassée
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-vault" -Target "<chemin-de-ce-dossier>"
```

```bash
# macOS / Linux
ln -s "<chemin-de-ce-dossier>" ~/.config/tabby/plugins/node_modules/tabby-better-vault
```

Relancer entièrement Tabby — recharger la fenêtre ne suffit pas.

## Utilisation

Ouvrir **Paramètres → Better Vault** et activer *Activer sur cette machine*.

À la prochaine demande du mot de passe maître, saisissez-le normalement : cette
saisie-là est capturée et confiée au trousseau du système. Ensuite, le
coffre-fort s'ouvre tout seul jusqu'à l'expiration ou la révocation.

## Journal d'audit

Le plugin conserve un journal des événements de cycle de vie dans
`better-vault.log`, à côté de `config.yaml` : quand le coffre a été déverrouillé
automatiquement, quand un jeton a expiré ou a été révoqué, et quand un garde-fou
a refusé d'opérer. Il s'ouvre et se vide depuis l'onglet de réglages. La durée de
conservation est configurable — 30 jours, 90 (par défaut), un an, ou illimitée.

```
[2026-07-28 23:19:20] INFO ──── session ouverte — machine « poste maison » — plugin actif — rétention 90 j
[2026-07-28 23:19:21] INFO  coffre déverrouillé depuis le trousseau du système
[2026-07-28 23:20:39] INFO  révocation manuelle depuis les réglages — jeton supprimé
```

**Il ne contient jamais votre mot de passe, ni sa longueur** — uniquement des
événements anonymes.

Deux limites méritent d'être dites franchement :

- **Il est local à chaque machine et le restera.** Le fichier d'état est
  délibérément exclu de toute synchronisation : il n'existe donc pas de vue
  d'ensemble entre vos machines, à moins d'en collecter les fichiers vous-même.
- **Il n'est pas infalsifiable.** C'est un fichier texte dans votre propre
  session, modifiable par quiconque y a accès — c'est-à-dire précisément
  l'attaquant contre lequel un journal d'audit servirait. À considérer comme un
  outil de diagnostic et de détection après coup, pas comme une preuve.

## Fonctionnement

**Tabby n'expose aucune API permettant d'injecter le mot de passe maître.** Son
cache est une variable de portée module, délibérément rendue inaccessible
depuis les champs de `VaultService`. La seule voie praticable consiste à
remplacer `getPassphrase` sur l'instance du service obtenue via l'injecteur
Angular partagé — la même approche que
[tabby-vault-keepassxc](https://github.com/chomoe327/tabby-vault-keepassxc).
Ce n'est **pas un point d'extension documenté**, et cela peut casser lors d'une
mise à jour de Tabby.

Quelques conséquences à connaître :

- **Le mot de passe est vérifié avant d'être servi.** Le plugin réimplémente
  localement le déchiffrement du coffre pour s'assurer que le mot de passe
  enregistré l'ouvre réellement. Appeler le `decrypt()` de Tabby retomberait
  directement sur `getPassphrase` — notre propre fonction — et bloquerait le
  démarrage.
- **Les réglages vivent hors de `config.yaml`.** Avec le chiffrement de
  configuration activé, tout sauf `vault`, `encrypted` et `configSync` se
  trouve dans le blob chiffré — y compris les réglages de ce plugin, qui
  exigeraient alors le mot de passe que nous sommes justement chargés de
  fournir. L'état est conservé dans `better-vault.json`, à côté de
  `config.yaml`.
- **Ce fichier n'est jamais synchronisé.** La synchronisation de Tabby envoie
  tout `config.yaml` et écrase la copie locale par la version distante. Un
  jeton propre à une machine placé là ferait s'effacer mutuellement les jetons
  de deux machines, en boucle. Le garder à part fait aussi que chaque machine a
  naturellement ses propres réglages.
- **Le mot de passe en clair ne survit à aucun appel.** Jamais mis en cache,
  jamais placé dans un champ, jamais journalisé — pas même sa longueur.

## Sécurité

| | |
|---|---|
| **Ce qui est stocké** | Votre mot de passe maître, chiffré par le trousseau du système |
| **Où** | `better-vault.json`, dans le dossier de configuration de Tabby |
| **Qui peut le lire** | Sous Windows, votre seul compte utilisateur sur cette machine (DPAPI est lié à l'utilisateur) ; sous macOS, quiconque peut déverrouiller votre trousseau de session |
| **Comment révoquer** | *Oublier maintenant* dans les réglages, ou supprimer le fichier |

Sous Linux, le `safeStorage` d'Electron bascule sur un backend `basic_text`
lorsqu'aucun service Secret n'est joignable sur le bus de session. Dans ce mode,
la clé est dérivée d'un mot de passe **codé en dur** : le jeton serait lisible
par n'importe qui. Le plugin **refuse alors de fonctionner** plutôt que d'offrir
une fausse impression de sécurité.

Ce qui décide, c'est la disponibilité du trousseau, pas le bureau utilisé : une
session i3 ou Sway sur laquelle `gnome-keyring` tourne obtient le vrai backend,
et le plugin fonctionne normalement.

Ce plugin ne peut pas être plus sûr que le trousseau auquel il délègue. Si
votre modèle de menace inclut un attaquant ayant accès à votre session
utilisateur déverrouillée, enregistrer le mot de passe reste un compromis à
peser.

## Feuille de route

À court terme : publication sur npm et un panneau de
réglages commun regroupant sous un seul onglet tous les plugins
`tabby-better-*` installés.

La feuille de route complète, les notes techniques et les pièges rencontrés en
chemin se trouvent dans [`.AIRules/`](.AIRules/README.html) — à ouvrir dans un
navigateur.

## Projet frère

[**tabby-better-sidebar**](https://github.com/TooMuhtsh/tabby-better-sidebar) —
une barre latérale de connexions enrichie pour Tabby : favoris épinglés, statut
de connexion en direct, glisser-déposer, sélecteur d'icônes personnalisé.
Projet indépendant : aucun des deux plugins n'exige l'autre.

## Crédits

- [Tabby](https://github.com/Eugeny/tabby) d'Eugeny — le terminal que ce plugin
  étend
- [tabby-vault-keepassxc](https://github.com/chomoe327/tabby-vault-keepassxc) —
  antériorité sur le déverrouillage automatique du coffre-fort, et confirmation
  indépendante que patcher `getPassphrase` est la seule voie viable
- [ngx-toastr](https://github.com/scttcper/ngx-toastr) et
  [js-yaml](https://github.com/nodeca/js-yaml)

## Licence

MIT — voir [LICENSE](LICENSE).
