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
- [x] **Suit la langue de Tabby** — anglais, français, espagnol et allemand ;
      toute autre locale bascule en anglais (voir [Langues](#langues))
- [x] **Repli sûr** — en cas d'anomalie, retour silencieux à la fenêtre native
      de Tabby. Désactivé, il ne touche pas du tout au trousseau ; activé, un
      trousseau qui cesse de répondre coûte au pire un démarrage figé (voir
      [Trousseau verrouillé](#trousseau-verrouillé))
- [ ] Publication sur npm, installable depuis le gestionnaire de plugins
- [x] Vérification adversariale indépendante sous Linux, dont le refus du
      backend `basic_text`
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
[2026-08-01 11:24:00] INFO ──── session opened — machine “poste maison” — plugin enabled — retention 90 d
[2026-08-01 11:24:01] INFO bridge installed — the keychain will only be queried at the first unlock
[2026-08-01 11:24:26] INFO vault unlocked from the system keychain
[2026-08-01 11:31:02] INFO manual revocation from the settings — token deleted
```

**Il ne contient jamais votre mot de passe, ni sa longueur** — uniquement des
événements anonymes.

**Le journal est toujours en anglais, quelle que soit la langue de
l'interface.** C'est un fichier qu'on relit plus tard, parfois longtemps après
et parfois pour l'envoyer à quelqu'un d'autre : une ligne dont la langue
dépendrait de la locale active au moment de l'écriture ferait changer un même
fichier de langue en cours de route, et le rendrait impossible à parcourir de
façon fiable.

Deux limites méritent d'être dites franchement :

- **Il est local à chaque machine et le restera.** Le fichier d'état est
  délibérément exclu de toute synchronisation : il n'existe donc pas de vue
  d'ensemble entre vos machines, à moins d'en collecter les fichiers vous-même.
- **Il n'est pas infalsifiable.** C'est un fichier texte dans votre propre
  session, modifiable par quiconque y a accès — c'est-à-dire précisément
  l'attaquant contre lequel un journal d'audit servirait. À considérer comme un
  outil de diagnostic et de détection après coup, pas comme une preuve.

## Langues

Le plugin suit la langue configurée dans Tabby — il n'y a rien à régler. Il est
livré en **anglais, français, espagnol et allemand** ; sous toute autre locale,
l'interface bascule en anglais.

Ajouter une langue tient en un fichier dans `src/i18n/`, dont les clés sont les
chaînes sources anglaises, plus une ligne dans la table en tête de
`src/i18n/index.ts`. Lancer ensuite `npm run lint:i18n` : il refuse une table
incomplète, et attrape les erreurs que ce mécanisme commet autrement en silence
— une clé qui ne correspond plus à sa source, ou un `{paramètre}` perdu en
traduction.

Les contributions sont bienvenues, y compris pour les langues déjà présentes :
ces traductions n'ont pas été faites par des locuteurs natifs.

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

### Ce que coûte réellement l'enregistrement du mot de passe

Sans ce plugin, votre mot de passe maître ne touche jamais le disque. Avec lui,
il y est écrit — chiffré par le trousseau du système — dans
`better-vault.json`, et il devient **récupérable au repos, en votre absence, par
n'importe quel processus tournant sous votre compte**.

Ce n'est pas un défaut du plugin : c'est ce que signifie déléguer à
`safeStorage`. C'est le plus net sous Linux : GNOME Keyring n'applique aucun
contrôle d'accès par application, donc tout processus de votre session peut lire
l'entrée via D-Bus et déchiffrer le fichier hors ligne. Une vérification
indépendante l'a fait exactement ainsi le 2026-07-29 et a récupéré un mot de
passe maître de test, sans Electron ni Chromium. Sous Windows, DPAPI est lié à
votre compte utilisateur, ce qui revient au même pour tout ce qui s'exécute en
votre nom.

Un détail moindre, mesuré et non supposé : le jeton stocké est
**déterministe**. Chiffrer deux fois le même mot de passe donne un résultat
identique octet pour octet, l'OSCrypt de Chromium utilisant une IV fixe. C'est
une propriété de la plateforme, pas du plugin, et le fichier est en `0600` —
mais cela signifie que quiconque peut lire `better-vault.json` à deux dates sait
si votre mot de passe maître a changé, sans rien déchiffrer.

Ce plugin ne peut pas être plus sûr que le trousseau auquel il délègue. Le
compromis qu'il propose, c'est du confort contre un attaquant capable
d'exécuter du code dans votre session — à peser délibérément.

### Trousseau verrouillé

Un trousseau présent mais **verrouillé** bloque tous les appels à `safeStorage`
— mesuré, les trois. Votre système affiche bien une invite d'authentification,
et l'appel rend la main en quelques secondes dès que vous y répondez ; si
personne ne répond, il bloque aussi longtemps que l'invite reste affichée. Un
`try/catch` n'y peut rien — un appel bloquant n'est pas une exception — et un
appel synchrone ne peut pas être interrompu depuis le fil qu'il bloque.

Jusqu'au 2026-07-29, le plugin interrogeait le trousseau depuis le constructeur
de son module, donc sur le chemin de démarrage de Tabby, et **qu'il soit activé
ou non**. Sur un trousseau verrouillé, cela figeait Tabby à son écran de
démarrage, qui n'atteignait plus sa propre demande de mot de passe. Défaut
relevé par la vérification indépendante citée plus haut ; corrigé.

Ce que le plugin garantit désormais :

- **Désactivé** — il ne touche pas au trousseau, sa seule présence ne peut donc
  pas retarder le démarrage.
- **Activé** — le premier contact avec un trousseau verrouillé bloque toujours.
  Il n'existe aucun moyen d'apprendre qu'un trousseau ne répondra pas sans le
  lui demander. Si vous êtes devant votre écran, répondez à l'invite de votre
  système et Tabby poursuit. Sinon, il ne bloque **qu'une fois** : un témoin est
  écrit sur le disque avant chaque appel au trousseau, et retiré au retour.
  Quittez Tabby et relancez-le — le témoin resté en place indique au plugin de
  s'effacer, et vous retrouvez la fenêtre native de Tabby. Le panneau
  **Paramètres → Better Vault** affiche cet état suspendu et permet de le lever.
- **Lever cet état vérifie réellement le trousseau** — un aller-retour de
  chiffrement sur une valeur jetable, et non la simple lecture du nom du
  backend. Votre système peut vous demander de vous authentifier, et c'est le
  but : une vérification qui ne peut pas échouer ne vérifie rien. Entre le
  2026-07-29 et ce correctif, elle ne lisait que le nom : elle annonçait donc un
  succès sur un trousseau verrouillé, et le démarrage suivant rebloquait.

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
