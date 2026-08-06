# Remise à niveau proposée — charte `20260804-064238`

Ce projet reçoit la charte à jour (`20260804-064238`), mais venait de `20260803-182826` : deux
révisions intermédiaires touchent le noyau. Ce document propose ce qu'il pourrait valoir la peine
d'ajuster ici — rien n'est appliqué automatiquement.

## Ce qui a changé

**`20260803-200821`** — retrait de la table de correspondance avec l'ancienne numérotation
(`Règle N` → `A-x`), devenue une condition de retrait inatteignable ; et ajout du prochain numéro
d'invariant libre (`A-16`) en tête de la section sur la stabilité des identifiants (A-6 l'exigeait
sans que la charte se l'applique à elle-même).

**`20260804-064238`** — deuxième exception nommée d'A-4 : la **conversion de format** d'un journal
existant (tableau vers lignes de log, HTML vers Markdown) est permise sous quatre conditions
cumulatives (décidée en révision, en une fois, à contenu constant, vérifiée par comparaison des
textes extraits avant/après) — distincte d'une réduction, toujours hors exception. Et nouvelle
option `registre-livrés` : sépare par défaut la roadmap active du registre des chantiers déjà
livrés (annexe `annexes/REALISE.{{ext}}`), avec le plan correspondant en `GABARITS.md` § 9.

## Ce qu'il vaudrait la peine d'ajuster ici

- Si le journal de ce projet mentionne encore l'ancienne numérotation `Règle N`, c'est désormais au
  projet, s'il le souhaite, de porter sa propre note de correspondance — la charte ne la porte plus
  pour personne.
- Si une conversion de format de journal a déjà été envisagée pour ce projet, l'exception d'A-4 est
  désormais nommée et balisée : vérifier qu'elle satisfait les quatre conditions avant de l'invoquer.
- Option `registre-livrés` à trancher dans `.AIRules/PROFIL.md` si ce n'est pas déjà fait (défaut
  `non` en profil `minimal`, `oui` ailleurs) — pertinent si la roadmap accumule des chantiers déjà
  `Livré` ou `Adopté`.

Détail complet : `CHANGELOG.md` du dépôt canonique, entrées `20260803-200821` et `20260804-064238`.

Ce fichier se rapatrie dans la roadmap du projet puis se supprime à la fusion de cette branche —
il ne doit pas survivre au-delà.
