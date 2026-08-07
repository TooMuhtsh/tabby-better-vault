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

/**
 * Élection de l'hôte : `hostWeight` minimal parmi les contributions présentes
 * dans l'injecteur, égalité départagée par id alphabétique.
 *
 * Avec les poids actuels (sidebar 10 < vault 20), le vault n'est hôte que
 * seul : le cas « vault hôte d'une famille de plusieurs » est structurellement
 * impossible aujourd'hui, et son montage multi n'est pas implémenté côté
 * vault (panneau plat) — à traiter le jour où un membre de poids > 20
 * existera.
 */
export function isBetterPanelHost (injector: Injector): boolean {
    const contributions = KNOWN_PANEL_TOKENS
        .map(token => injector.get(token as any, null) as BetterPanelContribution | null)
        .filter((c): c is BetterPanelContribution => !!c)
    contributions.sort((a, b) => a.hostWeight - b.hostWeight || a.id.localeCompare(b.id))
    return contributions[0]?.id === 'vault'
}
