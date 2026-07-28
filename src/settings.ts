import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { BetterVaultSettingsTabComponent } from './components/settingsTab.component'

/** @hidden */
@Injectable()
export class BetterVaultSettingsTabProvider extends SettingsTabProvider {
    id = 'better-vault'
    icon = 'unlock'
    title = 'Coffre-fort auto'

    getComponentType (): any {
        return BetterVaultSettingsTabComponent
    }
}
