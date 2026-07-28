import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

// Importé ici et pas dans le composant de réglages : la notification peut
// survenir sans que l'onglet ait jamais été ouvert, donc sans que le style du
// composant ait été chargé.
import './toast.scss'

import { BetterVaultSettingsTabComponent } from './components/settingsTab.component'
import { BetterVaultSettingsTabProvider } from './settings'
import { VaultBridgeService } from './vaultBridge.service'
import { crit, startSession, applyRetention } from './logger'

// Purge avant d'ouvrir la session : les lignes du jour ne doivent jamais être
// candidates à leur propre suppression.
applyRetention()
startSession()

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: SettingsTabProvider, useClass: BetterVaultSettingsTabProvider, multi: true },
    ],
    declarations: [
        BetterVaultSettingsTabComponent,
    ],
    // Volontairement pas de ConfigProvider : les réglages de ce plugin ne
    // peuvent pas vivre dans config.yaml, qui est lui-même chiffré dans le cas
    // d'usage principal. Ils sont dans better-vault.json — voir src/store.ts.
})
export default class BetterVaultModule {
    /**
     * L'installation doit avoir lieu dans le constructeur du NgModule, et pas
     * plus tard : c'est le point le plus précoce où une instance de
     * VaultService existe, et il précède `ConfigService.init()` — donc la
     * demande de mot de passe du cas « config chiffrée » (piège #V4, vérifié).
     */
    constructor (bridge: VaultBridgeService) {
        try {
            bridge.install()
        } catch (e) {
            // Ce plugin est un confort : il ne doit jamais empêcher Tabby de
            // démarrer, quoi qu'il arrive.
            crit(`installation échouée — ${String(e)}`)
        }
    }
}
