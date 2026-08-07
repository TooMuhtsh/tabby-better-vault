import { isProfileExcluded, readSettings, setProfilesExcluded } from './store'

/**
 * Contrat inter-plugins « exclusions du déverrouillage automatique ».
 *
 * CE QUE C'EST. `tabby-better-vault` publie ici, sous une clé de CHAÎNE, de quoi
 * lire et modifier la liste des profils exclus du déverrouillage automatique du
 * coffre. Le consommateur prévu est `tabby-better-sidebar`, qui en fait une
 * entrée de son menu contextuel de profil (et un raccourci sur un groupe, voir
 * plus bas) — chantier séparé, dans l'autre dépôt.
 *
 * LA CONVENTION, identique à celle du panneau de réglages unifié
 * (`src/betterPanel.ts`) : tous les plugins Tabby tournent dans le même process
 * Electron et partagent le même injecteur Angular ; la clé de chaîne est le seul
 * point de rencontre. JAMAIS d'import npm entre plugins, même optionnel. Le haut
 * de ce fichier — le jeton et l'interface, et eux seuls — est DUPLIQUÉ verbatim
 * dans le dépôt consommateur ; l'implémentation qui suit ne voyage pas (elle
 * dépend du store local) et n'a pas d'équivalent côté sidebar.
 *
 * OPTIONALITÉ STRICTE. Le consommateur résout
 * `injector.get(VAULT_EXCLUSIONS_TOKEN as any, null)` — jamais une injection
 * obligatoire. Sans ce plugin installé, le jeton résout `null` : la sidebar
 * n'affiche simplement pas l'entrée de menu, et rien n'échoue. Le contrat est un
 * bonus, pas une dépendance.
 *
 * VERSIONNEMENT. La version est DANS la chaîne (`:v1`). Toute rupture — signature
 * d'une méthode, ou sémantique d'un argument à signature constante — passe à
 * `:v2` et laisse `:v1` disparaître : deux versions du contrat peuvent alors
 * coexister le temps que les deux plugins se rejoignent, sans qu'aucune des deux
 * ne mente. Un AJOUT rétrocompatible ne change pas le numéro : le consommateur
 * teste la présence de la méthode avant de l'appeler.
 *
 * SÉMANTIQUE, à recopier telle quelle côté consommateur car elle décide de ce
 * que l'interface a le droit de promettre :
 *
 *   - Les identifiants sont des ids de PROFIL, jamais de groupe. Les ids de
 *     profil sont stables (un renommage ne les change pas) ; ceux de groupe ne le
 *     sont pas — un re-parentage côté sidebar recrée le groupe sous un nouvel
 *     uuid (piège hérité #12) et l'exclusion se perdrait en silence. Le « groupe »
 *     n'est donc qu'un raccourci d'interface : un clic sur un groupe passe ici les
 *     ids de ses MEMBRES, résolus au moment du clic — d'où `setExcluded()` qui
 *     prend un lot et l'applique en une seule écriture.
 *
 *   - Exclure un profil rend la saisie MANUELLE pour l'authentification par mot
 *     de passe de ce profil : le plugin laisse la pop-up native de Tabby faire son
 *     travail au lieu de servir le secret du coffre. Ce n'est PAS un
 *     cloisonnement des secrets — le coffre reste un blob chiffré unique, et
 *     n'importe quel profil NON exclu rouvre le service automatique pour tout le
 *     monde. De même, le déverrouillage au démarrage en config chiffrée n'a aucun
 *     profil à interroger (il précède la lecture de la liste des profils) : il
 *     reste automatique quoi qu'il y ait dans cette liste. Une interface qui
 *     laisse croire l'inverse ment à son utilisateur.
 *
 * NOMMAGE. Ne PAS appeler quoi que ce soit d'ici `VaultBridgeService` : ce nom
 * désigne déjà le pont INTERNE vers le `VaultService` de Tabby
 * (`src/vaultBridge.service.ts`), qui n'a rien à voir avec ce contrat-ci.
 *
 * VÉRIFICATION, règle de ce projet et condition pour s'y fier : avant qu'un
 * consommateur ne dépende de ce jeton, vérifier les DEUX niveaux — les typages
 * ET le bundle compilé du plugin réellement installé. Un symbole présent dans les
 * typages peut être absent du paquet livré, et l'inverse arrive aussi.
 */
export const VAULT_EXCLUSIONS_TOKEN = 'BetterVaultExclusions:v1'

export interface BetterVaultExclusions {
    /** Ce profil est-il exclu du déverrouillage automatique ? */
    isExcluded (profileId: string): boolean
    /**
     * Applique l'exclusion à un LOT d'ids, en une seule écriture. Le lot est ce
     * qui rend le raccourci « groupe » possible côté consommateur, sans qu'aucun
     * id de groupe n'entre ici.
     */
    setExcluded (profileIds: string[], excluded: boolean): void
    /** Liste complète des profils exclus — toujours une COPIE, jamais l'état interne. */
    excludedIds (): string[]
}

/**
 * Objet simple fourni en `useValue`, comme la contribution du panneau unifié, et
 * pour la même raison : déclaratif, aucune classe instanciée, donc aucun coût au
 * chargement du plugin. La fenêtre de tir de ce plugin est extrêmement précoce
 * (#V4 — en config chiffrée, la pop-up du coffre survient pendant le démarrage) ;
 * rien de ce qui s'enregistre à l'import ne doit y ajouter du travail.
 *
 * CHAQUE MÉTHODE EST GARDÉE. L'état vit dans un fichier (`better-vault.json`,
 * #V11) : il peut être illisible, verrouillé par un antivirus, ou en cours de
 * réécriture. Un store en défaut rend `false`, une liste vide, ou ne fait rien —
 * mais ne fait JAMAIS remonter d'exception dans le plugin consommateur, qui n'a
 * aucun moyen de la traiter et dont un menu contextuel ne doit pas se casser
 * parce qu'un autre plugin va mal.
 */
export const vaultExclusionsBridge: BetterVaultExclusions = {
    isExcluded (profileId: string): boolean {
        try {
            return isProfileExcluded(profileId)
        } catch {
            // Store illisible : on répond « pas exclu », le repli sûr — le
            // comportement nominal du plugin, jamais une entrave.
            return false
        }
    },

    setExcluded (profileIds: string[], excluded: boolean): void {
        try {
            // `setProfilesExcluded` relit le fichier avant de fusionner : deux
            // écrivains (ce pont et le panneau de réglages) ne s'écrasent pas.
            setProfilesExcluded(profileIds, excluded)
        } catch {
            // Écriture impossible : l'exclusion n'est pas enregistrée. Le
            // consommateur relira l'état réel par `excludedIds()`/`isExcluded()`
            // et verra que rien n'a changé.
        }
    },

    excludedIds (): string[] {
        try {
            // `readSettings()` reconstruit déjà le tableau à chaque appel ; la
            // copie explicite garantit la propriété quoi qu'il advienne du store.
            return [...readSettings().excludedProfiles]
        } catch {
            return []
        }
    },
}
