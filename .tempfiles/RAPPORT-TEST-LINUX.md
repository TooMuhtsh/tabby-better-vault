# Vérification adversariale de `tabby-better-vault` — Linux

**Date :** 2026-07-29
**Testeur :** campagne indépendante, sans accès aux notes des auteurs
**Objet :** réfuter les affirmations du plugin sur (1) son stockage interne et
(2) son garde-fou lié au trousseau du système sous Linux.

> **Note d'indépendance.** Le code source référence à plusieurs reprises des
> fichiers volontairement retirés du dépôt (`.AIRules/AI-CONTEXT.html`,
> `.AIRules/README.html`) et des numéros de pièges internes (`#V2`, `#V4`,
> `#V7`, `#V10`, `#V11`). Je ne les ai **pas** reconstitués ni recherchés
> ailleurs. Leur présence dans le code livré est signalée en §7 comme un fait
> de testabilité : un lecteur externe tombe sur des renvois morts.

---

## 1. Environnement

Relevé effectué **avant** tout test, complété par les versions des logiciels
installés pour le test.

| Élément | Valeur observée |
|---|---|
| Distribution | Ubuntu 24.04.4 LTS (noble) |
| Noyau | Linux 7.0.0-28-generic, x86_64, machine **VMware** (VM) |
| Bureau | GNOME Shell 46.0 (`XDG_CURRENT_DESKTOP=ubuntu:GNOME`) |
| Type de session | **graphique, X11** (`XDG_SESSION_TYPE=x11`, `ubuntu-xorg`), `WAYLAND_DISPLAY` vide, `DISPLAY=:0` |
| Bus de session | **présent** — `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus` |
| Trousseau | **gnome-keyring 46.1**, démon lancé avec `--components=pkcs11,secrets`, collection `login` **déverrouillée** au démarrage (PAM) |
| Service Secret | `org.freedesktop.secrets` actif sur le bus (`busctl --user list`) ; backend Electron retenu : `gnome_libsecret` |
| Tabby | **1.0.235** (dernière version stable, `dpkg-deb -f tabby.deb Version` → `1.0.235`) |
| Electron embarqué | **38.8.6** (`grep 'Electron/' tabby` → `Electron/38.8.6`) |
| Node (hôte) | v18.19.1, npm 9.2.0 |

**La session graphique est réelle** : le chemin nominal du trousseau **a pu être
exercé** (déverrouillage automatique observé en vrai dans Tabby, §4). Ce n'est
donc *pas* un demi-test sur ce point.

### Écarts d'environnement, et leur portée

Trois écarts, tous documentés car ils ont pu peser sur les résultats :

1. **Pas de `sudo` non interactif.** `sudo -n true` échoue (mot de passe
   requis). Je n'ai donc **pas** installé le `.deb` via `apt`. J'ai extrait le
   paquet dans l'espace utilisateur :
   `dpkg-deb -x tabby.deb ~/opt/tabby-root`. C'est **le même binaire non
   sandboxé** que le paquet Debian officiel (ni Flatpak ni Snap), simplement
   décompressé ailleurs. Le chemin de config reste `~/.config/tabby`,
   identique à une installation classique. Aucun confinement Flatpak/Snap n'a
   donc pu masquer un accès au bus ou au trousseau.
2. **`--no-sandbox` obligatoire.** Le `chrome-sandbox` extrait n'est pas
   `setuid root` (il faudrait `sudo`), donc Tabby refuse de démarrer sans
   `--no-sandbox`. Sans effet sur les deux domaines testés (stockage fichier et
   accès trousseau), qui ne dépendent pas du bac à sable Chromium.
3. **`--disable-gpu`.** Dans la VM, le rendu GPU donne une fenêtre noire ; en
   rendu logiciel l'interface s'affiche. Sans incidence sur la logique testée.

### Limite d'outillage GUI — importante

**L'injection clavier synthétique (xdotool/XTEST) n'atteint pas le moteur de
rendu Chromium de Tabby** : les clics souris fonctionnent (j'ai déroulé le menu
« Do not remember » du dialogue), mais `xdotool type` ne remplit pas le champ
« Master passphrase ». Le dialogue GTK/gcr de déverrouillage du trousseau, lui,
accepte bien les touches xdotool (autre pile graphique) — c'est ainsi que j'ai
pu saisir le mot de passe du trousseau plus tard.

**Conséquence :** je n'ai pas pu faire saisir le mot de passe maître
*directement dans la pop-up native de Tabby*. J'ai contourné en **fabriquant les
jetons** avec une application Electron 38.8.6 auxiliaire (mêmes primitives
`safeStorage`) puis en les injectant dans `better-vault.json`. Le chemin de
capture « premier usage » (`learnFromUser`) n'a donc pas été exercé de bout en
bout via l'IHM ; ses constituants (`encrypt`, `writeToken`) l'ont été. Voir §6.

---

## 2. Ce que j'ai installé et comment

Rejouable à l'identique.

```bash
# 1. Tabby 1.0.235 (paquet .deb officiel, non sandboxé)
curl -sL -o tabby.deb \
  https://github.com/Eugeny/tabby/releases/download/v1.0.235/tabby-1.0.235-linux-x64.deb
dpkg-deb -x tabby.deb ~/opt/tabby-root         # extraction (pas de sudo)
# binaire : ~/opt/tabby-root/opt/Tabby/tabby   → Electron/38.8.6

# 2. Construction du plugin depuis le dépôt en place
cd ~/tabby-better-vault
npm install --ignore-scripts   # OK
npm run build                  # webpack OK → dist/index.js (246 Ko), 2 warnings SCSS bénins

# 3. Installation là où Tabby charge les plugins
mkdir -p ~/.config/tabby/plugins/node_modules
ln -sfn ~/tabby-better-vault ~/.config/tabby/plugins/node_modules/tabby-better-vault

# 4. Lancement
~/opt/tabby-root/opt/Tabby/tabby --no-sandbox --disable-gpu
```

**Où Tabby charge le plugin :** `~/.config/tabby/plugins/node_modules/<nom>`
(le `main` de `package.json` pointe sur `dist/index.js`). Le lien symbolique
suffit ; Tabby l'a chargé et exécuté (voir la 1re ligne de journal ci-dessous).

**Configuration de test créée** (§ scripts `mkvault-enc.js`) :
`~/.config/tabby/config.yaml` avec **chiffrement de configuration activé**
(`encrypted: true`), un coffre `vault:` v1, et un **mot de passe maître jetable**
`MotDePasseJetable-Test-2026!` (jamais un vrai secret). En mode `encrypted:
true`, la pop-up de mot de passe apparaît à **chaque** démarrage : c'est le cas
d'usage principal du plugin.

**Impasses rencontrées** (consignées, non masquées) :
- `sudo ./tabby.deb` impossible → extraction manuelle (voir §1).
- Fenêtre Tabby **noire** en rendu GPU (VM) → `--disable-gpu`.
- Premier `pkill -f 'Tabby/tabby'` tuait **mon propre shell** (le motif matchait
  la ligne de commande de mon terminal) → passage à `pkill -f 'Tabb[y]/tabby'`.
- **Clavier synthétique inopérant** sur le renderer Chromium (voir §1, §6).

Outillage d'observation construit sur place : un convertisseur `xwd → PNG`
maison (aucun `scrot`/`import`/`gnome-screenshot` présent) ; un banc Electron
qui **compile et exécute le vrai `src/osKeychain.ts`** en interceptant
`require('@electron/remote')` ; un banc qui **compile et exécute le vrai
`src/store.ts`** en redirigeant `configDir()` vers un dossier jetable.

---

## 3. Stockage interne

### 3.1 Ce qui est stocké, où, sous quelle forme

- **Fichier :** `~/.config/tabby/better-vault.json`, à côté de `config.yaml`.
  Confirmé sur disque après exécution réelle de Tabby.
- **Forme :** JSON en clair, indenté. Réglages **et** jeton dans le même
  fichier. Le jeton (`token`) est le mot de passe maître **chiffré par l'OS**
  (`safeStorage.encryptString`, format Electron `v11`) puis encodé en base64.
  `tokenExpiresAt` est un timestamp ms.

```json
{
  "enabled": true, "debug": false, "machineName": "banc-test-linux",
  "logRetentionDays": 90,
  "expiry": { "mode": "schedule", "weekday": 1, "hour": 3, "days": 7 },
  "token": "djEx5xQOKdICN8tFivfbW5r7iKnsOY...",   // base64 d'un blob v11
  "tokenExpiresAt": 1785928404265
}
```

- **Le README dit vrai sur deux points vérifiés :** les réglages vivent hors de
  `config.yaml` (le module n'enregistre **aucun** `ConfigProvider`, confirmé
  dans `index.ts`), et j'ai confirmé indépendamment **pourquoi** c'est
  nécessaire : avec `encrypted: true`, la désérialisation de Tabby
  (`ConfigService.maybeDecryptConfig`, extraite de `app.asar`) place *tout* sauf
  `vault`/`encrypted`/`configSync` **à l'intérieur du blob chiffré**. Lire les
  réglages du plugin depuis `config.yaml` exigerait donc le mot de passe que le
  plugin cherche justement à fournir. Affirmation **vérifiée** par lecture du
  code de Tabby, pas seulement du commentaire du plugin.

### 3.2 Permissions — une affirmation partiellement RÉFUTÉE

Le code annonce `mode 0600 : lisible par le seul propriétaire`
(`store.ts:writeSettings`). J'ai exercé le **vrai** `writeSettings` sur un
dossier jetable :

```
umask = 2
A) création fraîche         -> mode 600   (attendu 600)     ✅
B) préexistant 644, réécrit -> mode 644   (NON re-serré)    ❌
C) préexistant 666, réécrit -> mode 666   (NON re-serré)    ❌
```

**Cause :** `fs.writeFileSync(path, data, { mode: 0o600 })` n'applique le mode
qu'à la **création**. Si le fichier existe déjà avec des permissions plus
larges, Node ne le `chmod` pas — le plugin ne re-serre jamais. Le fichier créé
sur cette machine par le vrai Tabby était bien `-rw-------` (600), donc **le cas
nominal est correct**. Mais l'invariant « lisible par le seul propriétaire »
n'est **pas maintenu** si le fichier préexiste en mode large (restauration de
sauvegarde, copie manuelle, version antérieure, umask différent). Verdict :
**vrai à la création, faux comme invariant.**

### 3.3 Écriture non atomique

`writeSettings` fait un `writeFileSync` direct, **sans** fichier temporaire +
`rename`. Une coupure en pleine écriture peut tronquer le fichier. Impact
**atténué** par la lecture défensive (§3.4, cas 2) : un fichier corrompu
retombe sur les défauts → le jeton est perdu, l'utilisateur ressaisit. Pas de
blocage, mais pas d'atomicité non plus. (Déduit du code + confirmé par le cas
« JSON tronqué ».)

### 3.4 Scénarios dégradés — sur le VRAI `store.ts`

Chaque ligne = un fichier `better-vault.json` fabriqué, passé au vrai
`readSettings`/`readToken`/`tokenHasExpired`/`computeExpiry` compilé depuis les
sources.

| # | Contenu injecté | Résultat observé | Verdict |
|---|---|---|---|
| 1 | fichier **absent** | défauts, `enabled=false` (plugin inactif) | robuste ✅ |
| 2 | JSON **tronqué** `{ "enabled": true, "token` | `parse` échoue → défauts, `enabled=false` | robuste ✅ |
| 3 | fichier **vide** | défauts | robuste ✅ |
| 4 | `enabled:"true"` (**chaîne**) | `enabled=false` (test `=== true` strict) | robuste ✅ |
| 5 | `logRetentionDays:999999` | ramené à `90` (borne max 3650) | borné ✅ |
| 5b | `logRetentionDays:-5` | ramené à `90` | borné ✅ |
| 5c | `logRetentionDays:0` | conservé `0` (= illimité, légal) | correct ✅ |
| 6 | `expiry:{mode:"forever",weekday:9,hour:99,days:9999}` | `{mode:"schedule",weekday:1,hour:3,days:7}` (chaque champ borné) | borné ✅ |
| 7 | `token:12345` (**nombre**) | `token=null` (non-chaîne rejetée) | robuste ✅ |
| 8 | `token:"@@@pas-du-base64@@@"` | **chaîne conservée** ; `readToken()` → `Buffer<a5 ab 3e 76 …>` | voir ci-dessous ⚠️ |
| 9 | `tokenExpiresAt:"demain"` | `null` (non-nombre rejeté) | robuste ✅ |
| 10 | `tokenExpiresAt:1` (passé) | `tokenHasExpired=true` | correct ✅ |
| 11 | `tokenExpiresAt` futur | `tokenHasExpired=false` | correct ✅ |
| 13 | `computeExpiry(sliding, days=NaN)` | échéance = maintenant + 7 j (garde anti-NaN) | correct ✅ |
| 14 | `computeExpiry(never)` | `null` | correct ✅ |

**Cas 8 — base64 non validé.** `readToken` fait `Buffer.from(token, 'base64')`
sans vérifier la validité : `Buffer.from` **tolère** et tronque silencieusement
les caractères hors alphabet. Un `token` falsifié à la main produit donc un
Buffer arbitraire au lieu de `null`. **Ce n'est pas exploitable** : en aval,
`serveFromToken` fait `decrypt(blob)` dans un `try/catch` — un blob invalide
lève, le jeton est purgé, retour à la saisie manuelle. Chaîne de repli vérifiée
en bout (§3.5). C'est une tolérance inélégante, sans conséquence de sécurité.

### 3.5 Vérification du jeton avant service — sur le VRAI code

Constituants exercés (crypto pure, sans trousseau) :

| Cas | Résultat | Attendu |
|---|---|---|
| `readStoredVault` sur `config.yaml` valide | OK, version 1 | ✅ |
| bon mot de passe vs coffre (`passphraseOpensVault`) | `true` | ✅ |
| mauvais mot de passe | `false` | ✅ |
| coffre **version ≠ 1** | `false` (rejet dur) | ✅ |
| `config.yaml` **sans** clé `vault` | `readStoredVault → null` | ✅ |
| `config.yaml` absent | `null` | ✅ |
| `vault` tronqué (iv manquant) | `null` | ✅ |
| `cleanUpLegacyToken` (ancien `better-vault-token.bin`) | supprimé ; 2ᵉ appel ne jette pas | ✅ |

**Bout-à-bout dans le vrai Tabby** (jeton fabriqué, injecté, Tabby relancé) :

- **Jeton chiffrant un MAUVAIS mot de passe** → le plugin le déchiffre (OS OK),
  le vérifie contre le coffre, le **rejette et le purge** :
  ```
  WARN jeton périmé (le mot de passe maître a changé ?) — purge et saisie manuelle
  → "token": null   (purgé)
  ```
- **Jeton chiffrant le BON mot de passe** → déverrouillage automatique :
  ```
  INFO jeton vérifié
  INFO coffre déverrouillé depuis le trousseau du système
  → "token" conservé (non purgé)
  ```

La vérification PBKDF2 locale (100 000 itérations, sha512, aes-256-cbc, copiée
de `tabby-core`) fait donc bien barrage à un jeton qui n'ouvre pas le coffre —
affirmation du README **vérifiée en vrai**.

---

## 4. Garde-fou du trousseau

Le plugin annonce **refuser d'opérer** quand le trousseau n'offre pas de
protection réelle (backend `basic_text`), et fonctionner normalement sinon. J'ai
exercé le **vrai `keychainStatus()`** (compilé depuis `src/osKeychain.ts`) dans
Electron 38.8.6, dans plusieurs états, plus le vrai Tabby.

### 4.1 Refuse-t-il quand il doit ? (sens « négatif »)

| Condition produite | `getSelectedStorageBackend` | `isEncryptionAvailable` | Verdict `keychainStatus()` | Correct ? |
|---|---|---|---|---|
| `--password-store=basic` | `basic_text` | `false` | `available:false` — *« backend basic_text : clé codée en dur, chiffrement non fiable »* | **✅ refuse à juste titre** |
| Sans bus (`DBUS_SESSION_BUS_ADDRESS` retiré) | `gnome_libsecret` | `false` | `available:false` — *« le système n'offre pas de chiffrement »* | **✅ refuse à juste titre** |

Le commentaire de `osKeychain.ts` prétend un **ordre des tests contre-intuitif** :
`getSelectedStorageBackend()` interrogé *avant* `isEncryptionAvailable()`, parce
que ce dernier renverrait déjà `false` en `basic_text` et masquerait le motif
précis. **Vérifié :** sous `--password-store=basic`, j'observe bien
`isEncryptionAvailable=false` **et** backend `basic_text`. Grâce à l'ordre
retenu, l'utilisateur reçoit le message explicite sur la clé codée en dur, pas
le message générique. Le commentaire s'avère **exact**, et le refus tombe sur le
motif `basic_text` en premier.

En `basic_text`, `encryptString` **lève** de surcroît (« Encryption is not
available ») : même si le garde-fou était contourné, rien ne serait écrit.

### 4.2 Accepte-t-il quand il doit ? (sens « positif »)

| Condition | Verdict | Preuve |
|---|---|---|
| `gnome_libsecret` **déverrouillé** (banc Electron) | `available:true, backend:"gnome_libsecret"`, aller-retour `encrypt`/`decrypt` **OK** | ✅ |
| Vrai Tabby, coffre chiffré, trousseau OK | `INFO pont installé — trousseau disponible (gnome_libsecret)` puis `coffre déverrouillé depuis le trousseau du système` | ✅ |

Le garde-fou **accepte** correctement le backend réel. Confirmé en conditions
réelles, pas seulement en banc.

### 4.3 Le cas que le code admet ne pas couvrir : trousseau PRÉSENT mais VERROUILLÉ

Le commentaire d'`osKeychain.ts` dit :
> *« Ce que ce diagnostic ne couvre PAS : un trousseau présent mais verrouillé.
> `getSelectedStorageBackend()` répond `gnome_libsecret` et
> `isEncryptionAvailable()` répond `true`, alors que `encryptString` échouera à
> l'usage. C'est le repli sur la méthode native de Tabby qui rattrape ce cas. »*

J'ai testé ce cas en **verrouillant réellement la collection `login`** via le
Secret Service D-Bus (`service.Lock(['/…/collection/login'])` → `Locked: True`).

**Résultat 1 — le garde-fou laisse passer (comme annoncé).** En simulant un
trousseau verrouillé (primitives « disponibles » mais `encrypt` qui lève), le
vrai `keychainStatus()` renvoie `available:true, backend:"gnome_libsecret"` : il
ne détecte pas le verrou. Conforme à l'aveu du code.

**Résultat 2 — mais l'affirmation « le repli rattrape ce cas » est RÉFUTÉE, et
c'est le défaut le plus grave trouvé.** Avec la collection `login` **réellement
verrouillée** et le plugin **activé**, j'ai lancé le vrai Tabby :

```
[13:17:32] INFO ──── session ouverte — machine « banc-test-linux » — plugin actif — rétention 90 j
        (… et RIEN d'autre — la ligne « pont installé » n'apparaît jamais)
```

Tabby **reste bloqué sur son écran de démarrage** (splash « Tabby α »)
indéfiniment (> 90 s, aucun dialogue de déverrouillage n'apparaît, processus
toujours vivant). Le banc instrumenté localise le blocage **exactement** :

```
[STEP] getSelectedStorageBackend...
[STEP] backend = gnome_libsecret
[STEP] isEncryptionAvailable...        ← se fige ici, ne renvoie jamais
```

`isEncryptionAvailable()` **bloque** sur un trousseau verrouillé (il tente de
lire/écrire l'entrée témoin, ce qui déclenche un déverrouillage qui n'aboutit
jamais sans prompt honoré). Or `keychainStatus()` est appelé **synchronement**
dans `install()`, lui-même appelé dans le **constructeur du NgModule** — donc le
démarrage d'Angular se fige. Le `try/catch` du code n'attrape rien : **un appel
bloquant n'est pas une exception.** Le « repli sur la méthode native » n'est
jamais atteint parce que le blocage survient *avant* que `getPassphrase` ne soit
même invoqué.

**Contrôle décisif — le plugin est bien la cause.** J'ai retiré le plugin
(déplacé le lien symbolique), trousseau **toujours verrouillé**, relancé Tabby :

```
→ Tabby atteint normalement la pop-up « Vault is locked / Master passphrase »
```

(capture d'écran : dialogue affiché, pas de blocage). Donc **sans le plugin,
Tabby demande le mot de passe et fonctionne ; avec le plugin, il se fige au
démarrage** quand le trousseau est verrouillé.

**Cela réfute directement le README :**
> *« Safe fallback — any failure quietly returns you to Tabby's own prompt; the
> plugin never blocks access to your vault. »*

Dans le cas « trousseau verrouillé », le plugin **bloque** l'accès au coffre :
Tabby n'atteint même plus sa propre pop-up.

**Portée / atténuation (par honnêteté).** Sur une session Ubuntu GNOME standard,
la collection `login` est déverrouillée par PAM à l'ouverture de session : la
condition est donc **peu fréquente**. Elle est cependant réelle : mot de passe
du trousseau différent du mot de passe de session, connexion automatique sans
déverrouillage PAM, ou verrouillage manuel du trousseau. Dans ces cas, la simple
**présence** du plugin (l'appel est fait même hors du toggle, à titre de
journalisation) fige le démarrage. **Défaut confirmé, sévérité haute,
déclenchement conditionnel.**

### 4.4 Verdict sur le garde-fou dans les deux sens

- **Sens négatif (refuser l'insécurité) :** correct et même soigné —
  `basic_text` et absence de chiffrement sont refusés avec le bon message.
  **VÉRIFIÉ.**
- **Sens positif (accepter le backend réel) :** correct, confirmé en vrai.
  **VÉRIFIÉ.**
- **Angle mort revendiqué (trousseau verrouillé) :** le diagnostic laisse passer
  *comme annoncé*, mais le mécanisme de rattrapage annoncé **n'existe pas** en
  pratique : au lieu d'un repli propre, on obtient un **gel du démarrage de
  Tabby**. **RÉFUTÉ** sur la promesse de repli sûr.

---

## 5. Tableau de synthèse

| # | Affirmation | Source | Verdict | Preuve (§) |
|---|---|---|---|---|
| 1 | Refuse le backend `basic_text` (clé codée en dur) | README + code | **VÉRIFIÉ** | §4.1 |
| 2 | Refuse quand aucun chiffrement OS (`isEncryptionAvailable=false`) | code | **VÉRIFIÉ** | §4.1 |
| 3 | Ordre des tests : backend avant disponibilité, pour un message exploitable | commentaire code | **VÉRIFIÉ** | §4.1 |
| 4 | Accepte et opère avec `gnome_libsecret` déverrouillé | README | **VÉRIFIÉ** (banc + vrai Tabby) | §4.2 |
| 5 | « Le repli natif rattrape le trousseau verrouillé » | commentaire code | **RÉFUTÉ** (gel du démarrage) | §4.3 |
| 6 | « Safe fallback… the plugin never blocks access to your vault » | README | **RÉFUTÉ** (cas verrouillé) | §4.3 |
| 7 | État rangé dans `better-vault.json` à côté de `config.yaml` | README | **VÉRIFIÉ** | §3.1 |
| 8 | Réglages hors `config.yaml` car config chiffrée (raison technique) | README/code | **VÉRIFIÉ** (via code de Tabby) | §3.1 |
| 9 | Fichier `mode 0600`, lisible par le seul propriétaire | commentaire code | **RÉFUTÉ comme invariant** (vrai à la création seule) | §3.2 |
| 10 | Fichier absent / corrompu / tronqué → plugin inactif, pas de plantage | comportement | **VÉRIFIÉ** | §3.4 |
| 11 | Valeurs hors bornes ramenées à des valeurs sûres | comportement | **VÉRIFIÉ** | §3.4 |
| 12 | `token` non-chaîne / `tokenExpiresAt` non-nombre → `null` | comportement | **VÉRIFIÉ** | §3.4 |
| 13 | `token` base64 falsifié → dégradation sûre (purge) | comportement | **VÉRIFIÉ** (tolérant mais sûr en bout) | §3.4/§3.5 |
| 14 | Mot de passe vérifié (PBKDF2) avant d'être servi ; mauvais jeton purgé | README/code | **VÉRIFIÉ en vrai** | §3.5 |
| 15 | Le jeton n'est jamais synchronisé (fichier strictement local) | README | **NON TESTABLE** (pas de 2ᵉ machine / config sync) | §6 |
| 16 | Journal ne contient jamais le mot de passe ni sa longueur | README | **VÉRIFIÉ** (inspection du journal produit) | §7 |
| 17 | Capture « premier usage » depuis la pop-up native | README | **NON TESTABLE de bout en bout** (clavier GUI), constituants vérifiés | §6 |
| 18 | Un même jeton n'est protégé que par la clé `safeStorage` de la session | déduit | **VÉRIFIÉ** — clé extraite hors ligne, mot de passe reconstitué | §7 |

---

## 6. Ce que je n'ai pas pu tester, et pourquoi

- **Capture du mot de passe depuis la pop-up native de Tabby (`learnFromUser`),
  de bout en bout.** L'injection clavier XTEST n'atteint pas le renderer
  Chromium (les clics oui, les touches non). Je n'ai donc pas fait *taper* le
  mot de passe dans la fenêtre Tabby. **Contourné** en fabriquant les jetons
  avec une app Electron 38.8.6 auxiliaire puis en les injectant : cela exerce
  `serveFromToken` (déverrouillage auto) mais **pas** le tout premier
  enregistrement via l'IHM. Les briques (`encrypt`, `writeToken`,
  `announceStorage`) sont vérifiées séparément ; l'enchaînement GUI ne l'est
  pas. C'est un **« non testé »**, pas un « conforme ».
- **La non-synchronisation du jeton.** Testable seulement avec deux machines et
  la config sync active. Non monté ici. **Non testable** dans ce banc.
- **Backends Windows (DPAPI) et macOS (Keychain).** Hors plateforme.
  `getSelectedStorageBackend` n'existe même pas là-bas ; le chemin
  `isEncryptionAvailable` seul y sert. Non exerçable sous Linux.
- **Notification/toast in-app.** Non observé visuellement (dépend d'un onglet
  actif et du timing ; l'IHM était difficile à piloter). Le déclenchement est
  attesté par le journal (`coffre déverrouillé…`), pas par une capture du toast.

---

## 7. Anomalies et surprises

1. **Gel du démarrage de Tabby, trousseau verrouillé (hors et dans le toggle).**
   Détaillé en §4.3. Surprise majeure : `install()` appelle `keychainStatus()`
   **inconditionnellement** (même `enabled:false`, pour journaliser). La seule
   présence du plugin installé suffit donc à figer Tabby si le trousseau est
   verrouillé au lancement.

2. **Le jeton est récupérable HORS LIGNE par tout processus de la session — et
   le mot de passe maître avec.** *(Caractérisation du niveau réel de
   protection ; le README l'admet en creux — « cannot be more secure than the
   keychain it delegates to » — mais l'ampleur mérite d'être montrée.)*
   - La clé `safeStorage` est rangée dans la collection `login` sous
     `application: 'tabby'`. Je l'ai **lue directement via D-Bus**, sans Electron
     ni Chromium (script `readkey.py`) : `nzwduX+gEdvnbeYdgA90Bw==` (24 octets).
   - Une **application tierce se déclarant `name: "tabby"`** obtient **la même
     clé** (aucune nouvelle entrée créée dans le trousseau) : elle peut donc
     *fabriquer* des jetons que le plugin accepte (démontré : un jeton forgé par
     une app « tabby » factice a été **accepté** et a déverrouillé le coffre).
   - À partir de cette clé, j'ai **reconstitué le mot de passe maître hors
     ligne** depuis `better-vault.json` (format v11 = AES-128-CBC, clé =
     PBKDF2-HMAC-**SHA1**, sel fixe `saltysalt`, **1 seule** itération, IV = 16
     espaces) :
     ```
     MOT DE PASSE MAÎTRE RÉCUPÉRÉ HORS LIGNE : 'MotDePasseJetable-Test-2026!'
     ```
   Autrement dit, face à un attaquant **déjà dans la session déverrouillée**, le
   stockage n'apporte quasiment aucune protection (KDF décoratif). C'est inhérent
   à `safeStorage`/`gnome_libsecret`, pas propre au plugin — mais cela relativise
   fortement « votre mot de passe, chiffré par le trousseau de l'OS ».

3. **Renvois morts dans le code livré.** Le source pointe vers des fichiers
   retirés du dépôt : `osKeychain.ts` → `.AIRules/AI-CONTEXT.html, piège #V7` ;
   `store.ts` → `#V11` ; `vaultBridge.service.ts` → `#V2` ; `index.ts` → `#V4` ;
   `vaultCrypto.ts` → `.AIRules/AI-CONTEXT.html, piège #V10` ; `README.md` →
   `.AIRules/README.html`. Je ne les ai pas ouverts. **Fait de testabilité :** un
   contributeur externe rencontre des références internes non résolvables ; la
   promesse README « le roadmap et les pièges vivent dans `.AIRules/` » pointe
   vers du vide dans le dépôt distribué.

4. **Journal — invariant « jamais le mot de passe » tenu.** Inspection du
   `better-vault.log` produit pendant tous les tests : uniquement des événements
   de cycle de vie (`session ouverte`, `pont installé`, `jeton vérifié`, `coffre
   déverrouillé`, `jeton périmé … purge`). Aucune trace du mot de passe ni de sa
   longueur. Conforme.

5. **`isEncryptionAvailable()` n'affiche aucun dialogue de déverrouillage** dans
   ce contexte (ni banc nu, ni Tabby) : il **bloque en silence** au lieu de
   provoquer un prompt gcr. Le prompt gcr n'apparaît que sur une demande D-Bus
   explicite `Unlock` (que j'ai dû piloter à la main pour rétablir le trousseau).
   Comportement surprenant, à l'origine du gel plutôt que d'une erreur.

---

## 8. Ce que je ferais tester ensuite

- **Corriger puis re-tester le cas verrouillé :** rendre `keychainStatus()` non
  bloquant (timeout / appel asynchrone hors constructeur, ou sonde `encrypt`
  d'une valeur témoin sous timeout) et vérifier que Tabby retombe bien sur sa
  pop-up native. C'est l'angle mort le plus important laissé ouvert.
- **Capture GUI de bout en bout** sur une machine où l'injection clavier atteint
  le renderer (session X11 sans la particularité observée, ou via l'automation
  DevTools d'Electron) : exercer `learnFromUser`, la notification, et l'expiration
  réelle (`schedule`/`sliding`).
- **Synchronisation multi-machines :** monter la config sync de Tabby sur deux
  postes et confirmer que `better-vault.json` n'est jamais propagé ni écrasé.
- **Robustesse à la rotation de la clé `safeStorage`** (trousseau recréé) : le
  jeton devient indéchiffrable → vérifier la purge propre.
- **Windows/macOS :** valider le chemin `isEncryptionAvailable` seul (là où
  `getSelectedStorageBackend` est absent) et le caractère user-scoped de DPAPI.
- **Concurrence :** plusieurs `getPassphrase()` simultanés au démarrage (le code
  sérialise via `this.pending`) — vérifier qu'aucune course ne double la
  vérification PBKDF2 ni la notification.

---

### Annexe — commandes clés reproduites

```bash
# Backend réel + verdict du VRAI keychainStatus() (banc Electron 38.8.6)
electron --no-sandbox .                       # → available:true, gnome_libsecret, roundtrip OK
electron --no-sandbox --password-store=basic .# → available:false, motif basic_text ; encrypt lève
env -u DBUS_SESSION_BUS_ADDRESS electron … .  # → available:false, isEncryptionAvailable=false

# Verrouillage réel de la collection puis vrai Tabby → GEL au splash ;
# plugin retiré, trousseau toujours verrouillé → pop-up « Master passphrase » OK

# Extraction hors ligne de la clé et du mot de passe
python3 readkey.py        # → clé safeStorage 24 o, via D-Bus, sans Electron
python3 decrypt_token.py 'nzwduX+gEdvnbeYdgA90Bw=='
# → MOT DE PASSE MAÎTRE RÉCUPÉRÉ HORS LIGNE : 'MotDePasseJetable-Test-2026!'

# Jeton forgé par une app tierce nommée "tabby" → accepté par le plugin (coffre déverrouillé)
```