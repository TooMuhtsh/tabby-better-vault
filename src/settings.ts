import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

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

    getComponentType (): any {
        return BetterVaultSettingsTabComponent
    }
}
