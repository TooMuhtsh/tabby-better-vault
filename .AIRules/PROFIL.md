# tabby-better-vault — Profil de gouvernance

Réponses de cadrage de ce projet. La charte qui les rend nécessaires est
[`GOUVERNANCE-IA.md`](./GOUVERNANCE-IA.md), partie B.

- **Profil de départ** : `complet`
- **Charte au moment du cadrage** : `20260731-204511`
- **Dernière revue de ce profil** : 2026-08-01

## Choix

| Clé | Choix | Pourquoi |
|---|---|---|
| `format` | `html` | quatre documents HTML statiques et une feuille de style partagée, en place depuis la création du dossier de gouvernance ; confirmé au cadrage |
| `documents` | `4` | `README` · `AI-CONTEXT` · `AI-HISTORY` · `ROADMAP`, séparés depuis l'origine |
| `fichier-instructions` | `CLAUDE.md` | seul assistant qui consomme ce dépôt aujourd'hui |
| `statuts` | `complet` | « À revérifier » est structurellement nécessaire ici : tout le plugin repose sur le remplacement de `VaultService.getPassphrase`, comportement non contractuel de Tabby (#V2). « Adopté » devient utilisable avec `outillage = oui` |
| `outillage` | `oui` | le plugin est d'abord l'outil quotidien de son auteur : « Adopté » distingue une fonctionnalité qui marche d'une fonctionnalité réellement utilisée dans le flux de travail |
| `tempfiles` | `oui` | `.tempfiles/` est déjà déclaré dans `.gitignore`, et porte les protocoles de campagne de test — qui contiennent des valeurs à saisir, donc à garder hors d'un dépôt public |
| `distant` | `oui` | `github.com/TooMuhtsh/tabby-better-vault` |
| `visibilité` | `public` | dépôt public dès le premier commit ; la liste de ce qui reste dehors est celle de l'option `visibilité` de la charte. Elle pèse davantage ici que sur un projet ordinaire : ce plugin manipule un secret utilisateur, et aucune phrase de test, aucun mot de passe de machine d'essai ne doit entrer dans le dépôt — leur place est `.tempfiles/` |
| `attribution` | `oui`, **hors lien de session** — trailer `Co-Authored-By` seul, jamais `Claude-Session` | tranché le 2026-08-01. Le co-auteur nomme le modèle : information de provenance utile, d'autant qu'une bascule silencieuse de modèle en session longue a déjà brouillé la provenance d'un résultat sur ce projet. Le lien de session, lui, publie une URL `claude.ai` sur un dépôt public — c'est « ce qui décrit la façon de travailler d'une personne plutôt que la façon de fonctionner du projet », que l'option `visibilité` range dehors. Les 32 commits antérieurs en portent encore un : leur nettoyage est un chantier distinct, ouvert en roadmap |
| `authentification` | compte `TooMuhtsh`, `gh` CLI authentifié via le trousseau de l'OS, opérations Git en HTTPS | identité de commit configurée **localement** à ce dépôt, pas globalement ; ne jamais committer sous une autre adresse sans confirmation |
| `branches` | `branche` | tranché au cadrage du 2026-08-01, en changement de la pratique antérieure : un chantier non abouti et sa documentation arrivent ensemble sur `master`, ce qui garantit A-10 mécaniquement plutôt que par vigilance |
| `seuil` | `strict` | un statut de chantier engage ; seul le contexte s'écrit au fil de l'eau. Le mot `MAJ` porte le feu vert en un geste |
| `roadmap-avant-code` | `oui` | une idée exprimée en vrac se consigne avec son design étudié et attend l'arbitrage ; l'implémentation démarre sur consigne explicite |
| `mot-cloture` | `MAJ` | transverse au workspace : feu vert d'A-3, mise à jour des documents, vérification de `CLAUDE.md`, commit, push — la chaîne s'arrête à la première étape qui échoue et dit où. **Moins distinctif qu'un mot rare** : c'est l'abréviation usuelle de « mise à jour », si bien que la règle de désambiguïsation rappelée dans `CLAUDE.md` porte ici l'essentiel du travail — dans le doute, demander plutôt qu'exécuter |
| `mot-cadrage` | `GOUVERNANCE` | transverse au workspace : rouvre cet entretien, en entier ou sur les clés nommées après le mot |
| `validation` | Test manuel dans Tabby, plugin monté par jonction NTFS dans le dossier de plugins installés, **process `Tabby.exe` tué et relancé en entier** après chaque modification. **Double par nature** : le plugin doit être exercé en configuration chiffrée *et* non chiffrée — un succès dans un seul des deux régimes ne prouve rien. Pour tout ce qui touche la disponibilité du trousseau, la validation n'est acquise que **sur la plateforme visée** : un défaut du Secret Service n'est pas reproductible sous DPAPI. Elle passe alors par une campagne opérée sur la VM Linux, avec un opérateur humain pour les saisies GUI. | un correctif écrit et poussé n'est pas validé. Ce projet a produit deux régressions en corrigeant trois défauts, et aucune des deux n'aurait été vue en relecture — le code était cohérent avec ce qu'on croyait savoir |
| `jetables` | Coffre-fort de test dédié sur la VM Linux crash-test : `config.yaml` fixture chiffrée par une phrase jetable, et le `better-vault.json` du profil de test. **Jamais le coffre réel de l'utilisateur, jamais son `better-vault.json`.** Les phrases exactes que l'opérateur devra saisir sont déclarées d'avance dans le protocole de campagne, qui vit dans `.tempfiles/` — hors dépôt, ce dépôt étant public. | ce projet ne manipule pas des entrées de configuration mais un secret utilisateur : aucun préfixe de nommage n'est possible, la séparation se fait par environnement |
| `test-manuel` | `oui` | checklist de test manuel précise et écoute passive des traces ; escalade vers un banc de mesure automatisé seulement aux trois conditions nommées par la charte |
| `support-test` | `8` | défaut appliqué, non tranché — question ouverte par la révision `20260803-182826`, à arbitrer au regard des campagnes opérées sur VM avec opérateur humain |
| `dépendances` | `minimales` | tranché au cadrage du 2026-08-01 : le `package.json` ne porte **aucune** dépendance d'exécution — tout est en `devDependencies`, `ngx-toastr` reste external parce que Tabby sert sa propre instance (#V8), et le déchiffrement du coffre est réimplémenté maison pour éviter la récursion sur `getPassphrase()` (#V10). La recherche d'une bibliothèque établie reste obligatoire (A-12), mais l'arbitrage penche explicitement vers l'implémentation maison et ne se rediscute pas à chaque fois |
| `discipline-test` | Deux choses hors d'atteinte en test : **le coffre-fort réel et le `%APPDATA%\tabby\better-vault.json` réel**. Toute valeur qu'un opérateur humain devra saisir **figure dans le protocole avant la campagne**, jamais improvisée devant une pop-up ; si une instance demande une valeur non prévue, l'opérateur refuse et le signale. **Les boîtes de dialogue GUI ne se pilotent pas** : l'injection clavier XTEST n'atteint pas le moteur de rendu Chromium de Tabby — les clics passent, les touches non ; l'humain les remplit lui-même. La configuration étant chiffrée par le coffre-fort, un déchiffrement temporaire pour observer l'état réel est admis ; le protocole Chrome DevTools reste réservé à la lecture des erreurs. | contourner une saisie GUI en fabriquant les jetons laisse la fonction non exercée — c'est exactement ce qui a laissé `learnFromUser` non testé à la première campagne. Et **une vérification qui ne peut pas échouer ne vérifie rien** : prendre une lecture bon marché (le nom du backend) pour une preuve de disponibilité est le défaut D1 |
| `validateur` | `html-validate` (devDependency), `npm run lint:airules` | commande exacte et périmètre dans `CLAUDE.md` ; devDependency, donc hors du livrable du plugin — compatible avec `dépendances = minimales`, qui porte sur ce qui est distribué |
| `veille-conformité` | `oui` — **mais la tâche est locale au poste de l'auteur et n'est pas versionnée ici** | une tâche planifiée interroge périodiquement le dépôt canonique et propage un écart **sur une branche dédiée** ; elle ne fusionne jamais d'elle-même et n'écrit jamais dans les documents de gouvernance. Elle vit dans le profil utilisateur de la machine, hors de ce dépôt, parce qu'elle relève du poste de travail et non du projet : un clone sur une autre machine **n'en hérite pas** et doit la regénérer localement s'il la veut. En son absence, la conformité se vérifie à la main en début de session (A-7), en comparant l'identifiant de `GOUVERNANCE-IA.md` à celui du dépôt canonique |

## Questions non tranchées

Aucune. Les vingt-deux options ont reçu une réponse explicite au cadrage du 2026-08-01 ;
aucune ligne ne porte « défaut appliqué, non tranché ».

## Historique des changements

Un changement de ce fichier est un changement structurant : il se propose, se valide, et
laisse une ligne au journal. Le tableau ci-dessus porte la valeur courante ; le journal
porte l'histoire.
