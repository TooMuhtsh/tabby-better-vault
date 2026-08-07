import { Injectable, Injector } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { BetterPanelElection, electBetterPanelHost, UNIFIED_TAB_ID, UNIFIED_TAB_TITLE } from './betterPanel'
import { BetterVaultHostPanelComponent } from './components/hostPanel.component'
import { BetterVaultSettingsTabComponent } from './components/settingsTab.component'

/** @hidden */
@Injectable()
export class BetterVaultSettingsTabProvider extends SettingsTabProvider {
    id = 'better-vault'
    icon = 'unlock'
    /** Nom distinct de l'onglet « Vault » natif, pour lever toute ambiguïté. */
    title = 'Better Vault'

    /**
     * Les onglets sont triés par
     * `a.weight - b.weight + a.title.localeCompare(b.title)`, et TOUS les
     * onglets natifs laissent `weight` à 0 — ils sont donc classés par ordre
     * alphabétique. Un poids de 2 dépasse à coup sûr le ±1 que peut renvoyer
     * `localeCompare` et nous place après eux, y compris après « Vault » dont
     * ce panneau est le prolongement.
     */
    weight = 2

    /**
     * Élection du panneau unifié « Better Tabby », faite une fois au démarrage :
     * les providers de tous les plugins sont déjà dans l'injecteur racine à la
     * construction, quel que soit l'ordre de chargement des modules.
     */
    private election: BetterPanelElection

    constructor (injector: Injector) {
        super()
        this.election = electBetterPanelHost(injector)
        if (this.election.isHost && this.election.unified) {
            this.id = UNIFIED_TAB_ID
            this.title = UNIFIED_TAB_TITLE
        }
    }

    /**
     * Rendre `null` est le mécanisme officiel de retrait : le constructeur de
     * `SettingsTabComponent` filtre les providers dont `getComponentType()`
     * rend une valeur fausse. On enregistre donc TOUJOURS ce provider — pas de
     * `useFactory` conditionnelle : `SettingsHotkeyProvider` parcourt tous les
     * providers et lit `id`/`title`, une entrée `null` dans le multi-provider
     * le ferait planter. Conséquence assumée : quand ce plugin n'est pas hôte,
     * le hotkey fantôme « Open settings tab: Better Vault » subsiste.
     *
     * Hôte d'une famille de plusieurs : le panneau hôte (un onglet par plugin).
     * Seul de sa famille : le panneau plat habituel, sans habillage.
     */
    getComponentType (): any {
        if (!this.election.isHost) {
            return null
        }
        return this.election.unified ? BetterVaultHostPanelComponent : BetterVaultSettingsTabComponent
    }
}
