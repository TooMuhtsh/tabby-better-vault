import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import TabbyCoreModule, { ConfigProvider } from 'tabby-core'

import { BetterVaultConfigProvider } from './config'
import { VaultBridgeService } from './vaultBridge.service'
import { log, startSession, LOG_PATH } from './logger'

startSession()

@NgModule({
    imports: [
        CommonModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: BetterVaultConfigProvider, multi: true },
    ],
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
            log(`installation échouée — ${String(e)}`)
        }
        log(`journal : ${LOG_PATH}`)
    }
}
