import { Injector, Type } from '@angular/core'

/**
 * Contrat du panneau de réglages unifié « Better Tabby ».
 *
 * Chaque plugin de la famille expose un provider Angular sous une clé de
 * CHAÎNE `BetterPanelContribution:<id>` — jamais d'import npm entre plugins :
 * ce fichier est DUPLIQUÉ dans chaque dépôt, la clé de chaîne est le seul
 * point de rencontre. Il n'importe aucun composant : types et fonctions
 * seulement, pour ne créer aucun cycle d'import.
 */
export interface BetterPanelContribution {
    id: string
    title: string
    hostWeight: number
    componentType: Type<any>
    /**
     * Mutable, remis à zéro à la lecture : posé à `true` par le deep-link du
     * plugin lui-même juste avant d'ouvrir l'onglet unifié ; le panneau hôte
     * élu — quel que soit le plugin qui le porte — le lit et l'efface à sa
     * construction pour présélectionner l'onglet de ce plugin. L'objet de
     * contribution voyageant tel quel entre plugins via l'injecteur, ce champ
     * les traverse sans import npm.
     */
    openRequested?: boolean
}

export const VAULT_PANEL_TOKEN = 'BetterPanelContribution:vault'

/**
 * Liste codée en dur des contributions connues : un futur plugin « Better X »
 * doit être ajouté ici (et dans la copie de ce fichier chez chaque membre de
 * la famille) pour participer à l'élection.
 */
export const KNOWN_PANEL_TOKENS = ['BetterPanelContribution:sidebar', VAULT_PANEL_TOKEN]

/**
 * Jeton que l'hôte fournit à l'injecteur du composant embarqué — sa présence
 * signale au composant qu'il est monté comme sous-onglet, pas comme onglet
 * racine.
 */
export const BETTER_PANEL_EMBEDDED = 'BetterPanelEmbedded'

/** Id et libellé de l'onglet unifié, quand plus d'une contribution est présente. */
export const UNIFIED_TAB_ID = 'better-tabby'
export const UNIFIED_TAB_TITLE = 'Better Tabby'

export interface BetterPanelElection {
    /** Ce plugin (contribution 'vault') a-t-il gagné l'élection ? */
    isHost: boolean
    /** Plus d'une contribution présente — l'onglet est partagé. */
    unified: boolean
    /** Toutes les contributions présentes, la nôtre comprise, dans l'ordre d'élection. */
    present: BetterPanelContribution[]
}

/**
 * Élection de l'hôte : `hostWeight` minimal parmi les contributions présentes
 * dans l'injecteur, égalité départagée par id alphabétique. Déterministe pour
 * tous les appelants : chaque plugin tire la même liste triée de son
 * injecteur, donc chacun conclut seul, sans coordination au-delà des jetons.
 */
export function electBetterPanelHost (injector: Injector): BetterPanelElection {
    const present = KNOWN_PANEL_TOKENS
        .map(token => injector.get(token as any, null) as BetterPanelContribution | null)
        .filter((c): c is BetterPanelContribution => !!c)
        .sort((a, b) => a.hostWeight - b.hostWeight || a.id.localeCompare(b.id))
    return {
        isHost: present[0]?.id === 'vault',
        unified: present.length > 1,
        present,
    }
}
