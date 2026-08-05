# Remise à niveau proposée — charte 20260804-071239

Trois révisions séparent la charte désormais en place (`20260804-071239`) de la précédente copie
de ce projet (`20260803-182826`). Deux sont purement additives (`20260803-200821`,
`20260804-071239`) et ne demandent rien. La troisième, `20260804-064238`, touche le noyau :

- **Deuxième exception nommée d'A-4** — convertir un journal existant d'un support à un autre
  (tableau vers lignes de log, HTML vers Markdown) est désormais permis sous quatre conditions
  cumulatives (décidée en révision, appliquée en une fois, à contenu constant, vérifiée par
  comparaison des textes avant/après). Ne s'applique que si ce projet envisage un jour de changer
  le format de son `AI-HISTORY`.
- **Option `registre-livrés`** (A-8) — sépare, si activée, la roadmap active du registre des
  chantiers déjà livrés (annexe `annexes/REALISE.{{ext}}`), ne laissant qu'une ligne de renvoi
  dans la roadmap. Un projet dont la roadmap est encombrée de chantiers `Livré`/`Adopté` peut y
  gagner en lisibilité.

**Ce que ce projet pourrait ajuster** : décider la valeur de `registre-livrés` dans son
`.AIRules/PROFIL.md` (absente aujourd'hui, elle vaudra par défaut selon le profil retenu), et
évaluer si sa roadmap gagnerait à basculer une partie de son détail vers un registre séparé.

Ceci est une proposition, jamais appliquée d'office. À rapatrier dans la roadmap du projet puis à
supprimer à la fusion de cette branche (A-7).
