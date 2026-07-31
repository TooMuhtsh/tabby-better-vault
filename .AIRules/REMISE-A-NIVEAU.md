# Remise à niveau — charte `20260731-204511`

Cette branche met à jour les **copies conformes** de la charte et ajoute les gabarits. Elle
n'écrit **aucune ligne** dans les documents du projet : ce qui suit est une **proposition**,
pas un état acquis (A-7).

Ce projet est resté **volontairement** sur une convention antérieure — c'est un état légitime
au sens d'A-7, et l'écart entre les deux identifiants *est* le signal. Rien ici n'est urgent.

> **Ce fichier meurt à la fusion.** Une fois la branche fusionnée, son contenu rejoint le
> chantier de roadmap qui porte la mise en conformité, et le fichier est supprimé. Le laisser
> vivre créerait deux emplacements pour le même fait (A-2) — c'est la règle que la révision
> `20260731-203812` ajoute justement à A-7.

## Révisions traversées

Le projet est conforme à la **charte du 2026-07-30**, antérieure aux identifiants de version.
Cinq révisions le séparent de l'état courant.

| Version | Régime | Ce qu'elle change |
|---|---|---|
| `20260731-204511` | purement additive | Le gabarit de `PROFIL.md` cesse de coder un identifiant de charte en dur : la ligne « Charte au moment du cadrage » attend `{{id}}`. |
| `20260731-203812` | touche le noyau | A-7 nomme le `REMISE-A-NIVEAU.md` et lui fixe une fin de vie ; l'historique quitte la charte pour un `CHANGELOG.md` resté dans le dépôt canonique ; prompt de démarrage dans le README canonique. |
| `20260731-150737` | touche le noyau | A-11 cesse de nommer `CLAUDE.md` en dur (option `fichier-instructions`) et sa vérification devient un point de passage ; options `mot-cloture` et `mot-cadrage` ; cinquième déclencheur d'entretien. |
| `20260731-135838` | touche le noyau | Refonte en noyau / options / entretien de cadrage. Identifiants `A-1`…`A-15` en remplacement des « Règles 1-7 » ; `GABARITS.md` et `PROFIL.md` apparaissent ; trace de dérive (A-5) ; deux régimes de révision. |
| 2026-07-31 (sans identifiant) | — | Colonne `Hash` ramenée à trois valeurs ; pastille « Adopté » ; compteur de numérotation ; chaîne de liens continue pour les annexes. |

Le détail est dans le
[changelog du dépôt canonique](https://github.com/TooMuhtsh/Claude-Governance/blob/master/CHANGELOG.md).

## Appliqué d'office sur cette branche

- `.AIRules/GOUVERNANCE-IA.md` → version `20260731-204511`
- `.AIRules/GABARITS.md` → **nouveau fichier**, absent jusqu'ici parce qu'il n'existait pas
  avant la révision `20260731-135838`

Vérifié par empreinte Git plutôt que par `diff` (voir les pièges ci-dessous) :
`6e5245426625ebc0a5cd590055d3875acdd4e7cd` et `10ddd25ac934fa0df09389ac6f55261af312ab35`,
identiques au dépôt canonique.

## Ce que le projet aurait à changer de lui-même

1. **`PROFIL.md` n'existe pas.** Le projet n'a jamais été cadré au sens de la partie C : ses
   options sont donc toutes à leur défaut, sans que ce soit une décision. Les **neuf questions
   sans défaut** (`visibilité`, `attribution`, `authentification`, `validation`, `jetables`,
   `discipline-test`, `validateur`, `mot-cloture`, `mot-cadrage`) restent ouvertes. C'est
   l'item le plus lourd, et le seul qui demande un entretien plutôt qu'une réécriture.
2. **Références à l'ancienne numérotation** — `README.html` (2), `ROADMAP.html` (1),
   `CLAUDE.md` (2) citent encore « Règle 1 », « Règle 3 », « Règle 7 ». À migrer vers les
   identifiants `A-x` via la table de correspondance en fin de charte.
   **`AI-HISTORY.html` (4 occurrences) ne se corrige pas** : le journal est en ajout seul
   (A-4). C'est précisément ce que cette table de correspondance existe pour absorber.
3. **Pied de page de `README.html`** — porte *« Conforme à la charte de gouvernance du
   2026-07-30 »*, l'ancienne forme datée. À passer à *« Conforme à la charte de gouvernance,
   version `20260731-204511` »*, mais **seulement une fois les points 1 et 2 traités** : la
   mention dit ce que le projet applique, pas ce que son dossier contient.
4. **Audit des documents** (A-15, cas B) — statuts de la roadmap confrontés à l'état réel du
   dépôt, invariants du contexte confrontés au code. Les trois correctifs de la campagne Linux
   sont poussés mais non validés en conditions réelles : à ce titre ils ne peuvent pas être
   marqués « Livré ».

## Pièges rencontrés pendant la propagation

- **`core.autocrlf=true` sur ce poste rend un `diff` nu trompeur.** Le dépôt canonique
  normalise en LF (`.gitattributes`), le fichier posé ici est réécrit en CRLF au premier
  `checkout` : `diff` signale alors un écart sur toutes les lignes alors que le contenu est
  identique. La vérification se fait sur les **empreintes Git** (`git hash-object`), qui
  comparent le contenu après normalisation.
- Ne pas copier ces fichiers avec un outil qui réécrit l'encodage : ils sont fortement
  accentués, et un aller-retour non garanti les altère silencieusement (A-12).

## Ménage

La branche `governance-sync-20260731-150737`, locale et distante, est **obsolète** : la
présente branche la remplace intégralement. À supprimer une fois celle-ci fusionnée.
