import { Component, HostBinding } from '@angular/core'

import { keychainStatus } from '../osKeychain'
import {
    Settings,
    readSettings,
    writeSettings,
    computeExpiry,
    deleteToken,
} from '../store'

/** @hidden */
@Component({
    // `templateUrl` ne fonctionne pas pour un plugin tiers — piège hérité #3.
    template: require('./settingsTab.component.pug'),
})
export class BetterVaultSettingsTabComponent {
    @HostBinding('class.content-box') true

    settings: Settings
    keychain = keychainStatus()

    readonly weekdays = [
        { value: 1, label: 'Lundi' },
        { value: 2, label: 'Mardi' },
        { value: 3, label: 'Mercredi' },
        { value: 4, label: 'Jeudi' },
        { value: 5, label: 'Vendredi' },
        { value: 6, label: 'Samedi' },
        { value: 0, label: 'Dimanche' },
    ]

    readonly hours = Array.from({ length: 24 }, (_, h) => h)

    constructor () {
        this.settings = readSettings()
    }

    get hasToken (): boolean {
        return !!this.settings.token
    }

    /**
     * Échéance du jeton actuellement enregistré, ou celle qu'aurait un jeton
     * créé maintenant — pour que l'utilisateur voie l'effet de son réglage
     * avant même d'avoir enregistré quoi que ce soit.
     */
    get expiryLabel (): string {
        if (this.settings.expiry.mode === 'never') {
            return 'aucune expiration'
        }
        const at = this.hasToken ? this.settings.tokenExpiresAt : computeExpiry(this.settings.expiry)
        if (!at) {
            return 'aucune expiration'
        }
        return new Date(at).toLocaleString()
    }

    save (): void {
        this.persist(false)
    }

    /**
     * Changer la politique recalcule l'échéance du jeton déjà enregistré :
     * sans cela, passer de « jamais » à « chaque lundi » n'aurait aucun effet
     * tant que le mot de passe n'est pas ressaisi.
     */
    onExpiryChanged (): void {
        this.persist(true)
    }

    forgetNow (): void {
        deleteToken()
        this.settings = readSettings()
    }

    /**
     * Écrit UNIQUEMENT les champs que ce panneau possède, fusionnés sur une
     * lecture fraîche du fichier.
     *
     * Ne jamais réécrire `this.settings` en bloc : le pont écrit le même fichier
     * de son côté, et cet objet date de l'ouverture de l'onglet. Un
     * enregistrement de mot de passe survenu depuis serait écrasé par le
     * `token: null` de notre instantané périmé — le mot de passe que
     * l'utilisateur vient de saisir disparaîtrait silencieusement. Symétrique­ment,
     * un jeton purgé par le pont serait ressuscité.
     */
    private persist (recomputeExpiry: boolean): void {
        const current = readSettings()
        const { enabled, debug, machineName, expiry } = this.settings
        const tokenExpiresAt = recomputeExpiry && current.token
            ? computeExpiry(expiry)
            : current.tokenExpiresAt
        writeSettings({ ...current, enabled, debug, machineName, expiry, tokenExpiresAt })
        // Relecture : l'affichage reflète le fichier, pas notre instantané.
        this.settings = readSettings()
    }
}
