// Import en side-effect : `styleUrls` ne fonctionne pas pour un plugin tiers
// (piège hérité #3), les styles sont injectés en CSS globale.
import './hostPanel.scss'
import { Component, HostBinding, Injector } from '@angular/core'

import { BETTER_PANEL_EMBEDDED, BetterPanelContribution, electBetterPanelHost } from '../betterPanel'

/**
 * L'onglet unifié « Better Tabby », quand CE plugin est élu hôte d'une famille
 * de plusieurs : un onglet par plugin présent, la contribution de ce plugin
 * comprise. N'est jamais instancié hors de ce cas — voir settings.ts, qui rend
 * le panneau plat habituel quand le plugin est seul de sa famille.
 */
@Component({
    // `templateUrl` ne fonctionne pas pour un plugin tiers — piège hérité #3.
    template: require('./hostPanel.component.pug'),
})
export class BetterVaultHostPanelComponent {
    /**
     * Convention d'onglet racine de Tabby (padding + largeur max) — ce
     * composant n'existe qu'en onglet racine, jamais embarqué.
     */
    @HostBinding('class.content-box') contentBox = true

    /** Toutes les contributions présentes, dans l'ordre d'élection — l'hôte en premier. */
    panels: BetterPanelContribution[]

    /** L'onglet plugin affiché ; celui de l'hôte à l'ouverture. */
    selected: string

    /**
     * Injecteur passé aux composants montés : le jeton BetterPanelEmbedded leur
     * dit qu'ils sont un onglet du panneau unifié, pas une page racine — c'est
     * lui qui leur fait retirer leur propre classe `content-box`.
     */
    embedInjector: Injector

    constructor (injector: Injector) {
        this.panels = electBetterPanelHost(injector).present
        // Le deep-link d'un plugin a pu demander son propre onglet juste avant
        // l'ouverture de ce panneau — honoré et effacé ici, pour qu'il ne fige
        // pas la sélection des visites suivantes. L'onglet de l'hôte sinon.
        const asked = this.panels.find(p => p.openRequested)
        if (asked) {
            asked.openRequested = false
        }
        this.selected = asked?.id ?? this.panels[0]?.id ?? ''
        this.embedInjector = Injector.create({
            providers: [{ provide: BETTER_PANEL_EMBEDDED, useValue: true }],
            parent: injector,
        })
    }

    /** `href='#'` donne aux onglets leur comportement de focus ; sans ceci la page sauterait en haut à chaque clic. */
    select (id: string, event: Event): void {
        event.preventDefault()
        this.selected = id
    }
}
