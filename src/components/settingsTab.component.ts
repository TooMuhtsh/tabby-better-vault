import { Component, HostBinding } from '@angular/core'
import { PlatformService } from 'tabby-core'

// Import en side-effect : `styleUrls` ne fonctionne pas pour un plugin tiers
// (piège hérité #3), les styles sont injectés en CSS globale.
import './settingsTab.component.scss'

import { guardState, describeState, rearm } from '../keychainGuard'
import { log, purge, LOG_PATH } from '../logger'
import { keychainStatus, KeychainStatus } from '../osKeychain'
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
    /**
     * Résultat du diagnostic, ou `null` tant qu'il n'a pas été fait.
     *
     * Ce champ valait `keychainStatus()` en initialiseur, donc la sonde partait
     * à la construction du composant, sans égard pour `enabled`. Sur trousseau
     * verrouillé, ouvrir les réglages figeait l'interface — et ce panneau est le
     * SEUL endroit d'où l'on peut désactiver le plugin : le gel emportait avec
     * lui le moyen d'en sortir. Voir `keychainGuard.ts`.
     *
     * La sonde n'a donc plus lieu qu'à la demande, ou quand le plugin est déjà
     * activé : dans ce cas le pont l'a de toute façon déjà faite au démarrage,
     * et l'utilisateur a explicitement consenti à ce contact.
     */
    keychain: KeychainStatus | null = null

    /**
     * Champs et non accesseurs : le gabarit les lit, et Angular réévalue une
     * expression de gabarit à CHAQUE cycle de détection — chaque frappe dans le
     * champ « nom de cette machine », chaque événement de souris. Un
     * `guardState()` derrière un `get` y ferait autant de `readFileSync`, dont
     * la plupart sur un fichier absent, donc autant d'exceptions levées puis
     * rattrapées. L'état ne change qu'aux endroits qui appellent
     * `refreshGuard()`.
     */
    suspended = false
    suspendedDetail = ''

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

    constructor (private platform: PlatformService) {
        this.settings = readSettings()
        this.refreshGuard()
        if (this.settings.enabled) {
            this.probeKeychain()
        }
    }

    private refreshGuard (): void {
        const state = guardState()
        this.suspended = state.suspended
        this.suspendedDetail = state.suspended ? describeState(state) : ''
    }

    /**
     * Interroge le trousseau, à la demande explicite de l'utilisateur.
     *
     * C'est le seul appel de ce panneau susceptible de bloquer. Il est protégé
     * par le garde-fou : si le trousseau ne répond pas, ce clic gèle Tabby une
     * fois, et une seule — au redémarrage suivant le panneau s'ouvre
     * instantanément sur l'état « suspendu », interrupteur d'arrêt compris.
     */
    probeKeychain (): void {
        this.keychain = keychainStatus()
        // La sonde peut consigner le trousseau à son tour : l'affichage doit
        // suivre sans attendre une réouverture du panneau.
        this.refreshGuard()
    }

    /**
     * Lève la consignation et re-sonde dans la foulée.
     *
     * Enchaîner les deux est délibéré : l'utilisateur ne clique ici qu'après
     * avoir déverrouillé son trousseau, et le laisser sur un état « suspendu »
     * levé mais non vérifié n'apprendrait rien de plus qu'avant le clic.
     */
    rearmKeychain (): void {
        rearm()
        log('garde-fou du trousseau levé manuellement depuis les réglages')
        this.refreshGuard()
        this.probeKeychain()
    }

    openLog (): void {
        this.platform.openPath(LOG_PATH)
    }

    /**
     * Purge sur confirmation : le journal est le seul historique des ouvertures
     * du coffre, et l'effacer est irréversible. Un clic malencontreux ne doit
     * pas suffire.
     */
    async purgeLog (): Promise<void> {
        const result = await this.platform.showMessageBox({
            type: 'warning',
            message: 'Vider le journal ?',
            detail: "Tout l'historique des ouvertures du coffre, des expirations et des révocations sera perdu. Cette action est irréversible.",
            buttons: ['Vider', 'Annuler'],
            defaultId: 1,
            cancelId: 1,
        })
        if (result.response === 0) {
            purge()
        }
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
        const { debug, machineName, expiry, logRetentionDays } = this.settings

        // Second verrou, derrière le `*ngIf` du gabarit : sans trousseau
        // utilisable, ce panneau ne doit pas pouvoir activer le plugin — écrire
        // `enabled: true` promettrait un comportement inatteignable. L'interrupteur
        // est masqué dans ce cas, mais on ne fait pas reposer une garantie de
        // sécurité sur la seule absence d'un élément d'interface.
        //
        // Mais il ne doit pas non plus l'ÉTEINDRE. Le fichier est propre à la
        // machine, pas à la session : un utilisateur ayant activé le plugin
        // depuis une session où le trousseau fonctionne, puis ouvrant ce panneau
        // depuis une session dégradée, perdrait son réglage sans l'avoir
        // demandé. On laisse donc la valeur du fichier intacte.
        //
        // `keychain` vaut `null` tant que le diagnostic n'a pas eu lieu : c'est
        // aussi un cas où l'on ne doit pas pouvoir activer, pour la même raison.
        const enabled = this.keychain?.available ? this.settings.enabled : current.enabled
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
