import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

// Importé ici et pas dans le composant de réglages : la notification peut
// survenir sans que l'onglet ait jamais été ouvert, donc sans que le style du
// composant ait été chargé.
import './toast.scss'

import { BetterPanelContribution, VAULT_PANEL_TOKEN } from './betterPanel'
import { VAULT_EXCLUSIONS_TOKEN, vaultExclusionsBridge } from './exclusionsBridge'
import { BetterVaultHostPanelComponent } from './components/hostPanel.component'
import { BetterVaultSettingsTabComponent } from './components/settingsTab.component'
import { BetterVaultSettingsTabProvider } from './settings'
import { I18nService } from './i18n'
import { ProfileExclusionsService } from './profileExclusions.service'
import { VaultBridgeService } from './vaultBridge.service'
import { crit, startSession, applyRetention } from './logger'
import { briefError } from './messages'

// Purge avant d'ouvrir la session : les lignes du jour ne doivent jamais être
// candidates à leur propre suppression.
applyRetention()
startSession()

/**
 * Contribution de ce plugin au panneau de réglages unifié « Better Tabby » —
 * voir src/betterPanel.ts pour le contrat et l'élection de l'hôte.
 */
const vaultPanelContribution: BetterPanelContribution = {
    id: 'vault',
    title: 'Better Vault',
    hostWeight: 20,
    componentType: BetterVaultSettingsTabComponent,
}

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: SettingsTabProvider, useClass: BetterVaultSettingsTabProvider, multi: true },
        { provide: VAULT_PANEL_TOKEN, useValue: vaultPanelContribution },
        // Pont inter-plugins de la granularité : consommé par la sidebar via
        // `injector.get(VAULT_EXCLUSIONS_TOKEN, null)` — voir le contrat dans
        // src/exclusionsBridge.ts. `useValue` déclaratif, comme la contribution
        // du panneau : rien d'instancié sur le chemin de démarrage (#V4).
        { provide: VAULT_EXCLUSIONS_TOKEN, useValue: vaultExclusionsBridge },
    ],
    declarations: [
        BetterVaultHostPanelComponent,
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
     *
     * CE CHEMIN NE DOIT TOUCHER NI LE TROUSSEAU, NI RIEN QUI PUISSE BLOQUER.
     * `install()` s'y tient ; c'est une contrainte de l'endroit, pas une
     * préférence de style. Voir le commentaire d'`install()`.
     */
    constructor (bridge: VaultBridgeService, exclusions: ProfileExclusionsService, i18n: I18nService) {
        // Avant le pont : `install()` du pont journalise, et une notification
        // servie entre-temps doit déjà pouvoir être traduite. Cet appel ne fait
        // que poser un abonnement — aucun disque, aucun trousseau, rien qui
        // puisse bloquer ce chemin de démarrage.
        try {
            i18n.install()
        } catch (e) {
            // L'interface reste en anglais : dégradé, jamais bloquant.
            crit(`could not set up translations — ${briefError(e)}`)
        }

        try {
            bridge.install()
        } catch (e) {
            // Ce plugin est un confort : il ne doit jamais empêcher Tabby de
            // démarrer, quoi qu'il arrive.
            //
            // Ce filet ne couvre QUE les exceptions. Un appel bloquant n'en est
            // pas une : rien ici ne rattraperait un gel, d'où la règle ci-dessus
            // et le garde-fou de `keychainGuard.ts`.
            crit(`installation failed — ${briefError(e)}`)
        }

        // APRÈS le pont, jamais avant : l'enveloppe des exclusions s'appuie sur
        // `runWithNativePrompt()`, donc sur un pont déjà posé — et si le pont a
        // échoué, il n'y a plus rien à faire déléguer. Même filet, séparé :
        // l'indisponibilité de `PasswordStorageService` (plugin SSH absent,
        // service déplacé par une mise à jour de Tabby) ne doit pas passer pour
        // un échec du déverrouillage automatique, qui lui fonctionne.
        //
        // Comme `install()` du pont, cet appel NE TOUCHE NI LE DISQUE, NI LE
        // TROUSSEAU, NI LA CONFIG : il ne fait que poser le patch. La liste
        // d'exclusion n'est lue qu'au moment d'une connexion — contrainte de
        // l'endroit (#V4), pas préférence de style.
        try {
            exclusions.install()
        } catch (e) {
            crit(`per-profile exclusions could not be installed — ${briefError(e)}`)
        }
    }
}
