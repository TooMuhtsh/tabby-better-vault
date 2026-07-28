import { Component, HostBinding } from '@angular/core'

// Import en side-effect : `styleUrls` ne fonctionne pas pour un plugin tiers
// (piège hérité #3), les styles sont injectés en CSS globale.
import './settingsTab.component.scss'

import { log, LOG_PATH } from '../logger'
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
    logPath = LOG_PATH

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

    readonly retentions = [
        { value: 30, label: '30 jours' },
        { value: 90, label: '90 jours' },
        { value: 365, label: '1 an' },
        { value: 0, label: 'Illimitée' },
    ]

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
        // Purge délibérée de l'utilisateur : c'est l'événement le plus
        // significatif du cycle de vie, il doit laisser une trace.
        log('révocation manuelle depuis les réglages — jeton supprimé')
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
        const { enabled, debug, machineName, expiry, logRetentionDays } = this.settings
        const tokenExpiresAt = recomputeExpiry && current.token
            ? computeExpiry(expiry)
            : current.tokenExpiresAt
        writeSettings({ ...current, enabled, debug, machineName, expiry, logRetentionDays, tokenExpiresAt })

        // Trace les changements qui modifient le comportement du plugin, pas
        // les cosmétiques (le nom de machine n'en fait pas partie).
        if (enabled !== current.enabled) {
            log(`plugin ${enabled ? 'activé' : 'désactivé'} sur cette machine`)
        }
        if (debug !== current.debug) {
            log(`mode observation ${debug ? 'activé' : 'désactivé'}`)
        }
        if (recomputeExpiry && JSON.stringify(expiry) !== JSON.stringify(current.expiry)) {
            log(`politique d'expiration modifiée : ${this.describeExpiry(expiry)}`)
        }

        // Relecture : l'affichage reflète le fichier, pas notre instantané.
        this.settings = readSettings()
    }

    private describeExpiry (expiry: Settings['expiry']): string {
        if (expiry.mode === 'never') {
            return 'aucune expiration'
        }
        if (expiry.mode === 'sliding') {
            return `${expiry.days} jour(s) après la saisie`
        }
        const day = this.weekdays.find(d => d.value === expiry.weekday)?.label ?? '?'
        return `chaque ${day.toLowerCase()} à ${expiry.hour} h`
    }
}
