import { Component, HostBinding } from '@angular/core'
import { PlatformService } from 'tabby-core'

// Import en side-effect : `styleUrls` ne fonctionne pas pour un plugin tiers
// (piège hérité #3), les styles sont injectés en CSS globale.
import './settingsTab.component.scss'

import { I18nService } from '../i18n'
import { guardState, describeState, rearm } from '../keychainGuard'
import { log, warn, purge, LOG_PATH } from '../logger'
import { english } from '../messages'
import { keychainStatus, keychainRoundTrip, KeychainStatus } from '../osKeychain'
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

    /** Motif de `keychain`, déjà traduit — voir `setKeychain()`. */
    keychainReason = ''

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

    /**
     * `source` et non `label` : c'est la chaîne source anglaise, que le gabarit
     * passe au pipe `translate`. Traduire ici, à la construction, figerait ces
     * listes dans la langue active à l'ouverture de l'onglet — un changement de
     * locale ne les rattraperait qu'à la réouverture du panneau.
     */
    readonly weekdays = [
        { value: 1, source: 'Monday' },
        { value: 2, source: 'Tuesday' },
        { value: 3, source: 'Wednesday' },
        { value: 4, source: 'Thursday' },
        { value: 5, source: 'Friday' },
        { value: 6, source: 'Saturday' },
        { value: 0, source: 'Sunday' },
    ]

    readonly hours = Array.from({ length: 24 }, (_, h) => h)

    readonly retentions = [
        { value: 30, source: '30 days' },
        { value: 90, source: '90 days' },
        { value: 365, source: '1 year' },
        { value: 0, source: 'Unlimited' },
    ]

    constructor (private platform: PlatformService, private i18n: I18nService) {
        this.settings = readSettings()
        this.refreshGuard()
        if (this.settings.enabled) {
            this.probeKeychain()
        }
    }

    private refreshGuard (): void {
        const state = guardState()
        this.suspended = state.suspended
        this.suspendedDetail = state.suspended ? this.i18n.message(describeState(state)) : ''
    }

    /**
     * Enregistre le résultat d'un diagnostic et en dérive le texte affiché.
     *
     * Champ et non accesseur, pour la raison donnée plus haut à propos de
     * `suspended` : un `get` serait réévalué à chaque cycle de détection, donc à
     * chaque frappe dans le champ « nom de cette machine ». `translate.instant()`
     * coûte moins qu'un `readFileSync`, mais rien n'oblige à le payer des
     * milliers de fois pour une valeur qui ne change qu'ici.
     *
     * Conséquence assumée, la même que pour `suspendedDetail` : changer la langue
     * de Tabby pendant que ce panneau est ouvert ne retraduit pas ce motif — il
     * faut rouvrir l'onglet. Le reste du panneau, lui, passe par le pipe
     * `translate` et suit immédiatement.
     */
    private setKeychain (status: KeychainStatus): void {
        this.keychain = status
        this.keychainReason = status.reason ? this.i18n.message(status.reason) : ''
    }

    /**
     * Diagnostic bon marché, à l'ouverture du panneau quand le plugin est déjà
     * actif. Ne prouve pas que le trousseau répond — voir `verifyKeychain()`.
     */
    private probeKeychain (): void {
        this.setKeychain(keychainStatus())
        // La sonde peut consigner le trousseau à son tour : l'affichage doit
        // suivre sans attendre une réouverture du panneau.
        this.refreshGuard()
    }

    /**
     * Vérification réelle, à la demande explicite de l'utilisateur.
     *
     * `keychainStatus()` ne convient PAS ici : sur Linux il se contente de lire
     * le nom du backend, mesuré comme ne touchant jamais le trousseau. Le
     * bouton annonçait donc « disponible » sur un trousseau verrouillé, effaçait
     * le témoin, et le démarrage suivant regelait — défaut D1 de la campagne du
     * 2026-07-29, sur le seul chemin de sortie offert à l'utilisateur.
     *
     * C'est le seul appel de ce panneau susceptible de bloquer, et c'est
     * délibéré : une vérification qui ne peut pas échouer ne vérifie rien. Sur
     * trousseau verrouillé, l'utilisateur voit l'invite d'authentification du
     * système et l'appel rend la main dès qu'il y répond.
     */
    verifyKeychain (): void {
        this.setKeychain(keychainRoundTrip())
        this.refreshGuard()

        // Tracé dans les deux sens : c'est le seul geste par lequel
        // l'utilisateur peut remettre le plugin en marche, son résultat doit
        // rester lisible après coup. En anglais, comme tout le journal — et via
        // `english()` plutôt que via le champ déjà traduit, sans quoi la ligne
        // suivrait la locale de l'utilisateur.
        const status = this.keychain as KeychainStatus
        if (status.verified) {
            log(`keychain verified from the settings — encryption round trip succeeded (${status.backend})`)
        } else {
            warn(`keychain verification from the settings failed — ${status.reason ? english(status.reason) : 'no reason given'}`)
        }
    }

    /**
     * Lève la consignation, puis vérifie réellement dans la foulée.
     *
     * Enchaîner les deux est délibéré : l'utilisateur ne clique ici qu'après
     * avoir déverrouillé son trousseau, et le laisser sur un état « suspendu »
     * levé mais non vérifié serait précisément le défaut D1 sous un autre nom.
     * Si le trousseau est en réalité toujours verrouillé, la vérification le
     * découvre — et si elle bloque, le témoin qu'elle vient de poser protège le
     * démarrage suivant.
     */
    rearmKeychain (): void {
        rearm()
        log('keychain guard lifted manually from the settings')
        this.refreshGuard()
        this.verifyKeychain()
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
            message: this.i18n.t('Empty the log?'),
            detail: this.i18n.t('All history of vault openings, expiries and revocations will be lost. This action cannot be undone.'),
            buttons: [this.i18n.t('Empty'), this.i18n.t('Cancel')],
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
            return this.i18n.t('no expiry')
        }
        const at = this.hasToken ? this.settings.tokenExpiresAt : computeExpiry(this.settings.expiry)
        if (!at) {
            return this.i18n.t('no expiry')
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
        log('manual revocation from the settings — token deleted')
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
            log(`plugin ${enabled ? 'enabled' : 'disabled'} on this machine`)
        }
        if (debug !== current.debug) {
            log(`observation mode ${debug ? 'enabled' : 'disabled'}`)
        }
        if (recomputeExpiry && JSON.stringify(expiry) !== JSON.stringify(current.expiry)) {
            log(`expiry policy changed: ${this.describeExpiry(expiry)}`)
        }

        // Relecture : l'affichage reflète le fichier, pas notre instantané.
        this.settings = readSettings()
    }

    /**
     * Politique d'expiration en une phrase, pour le journal — donc en anglais et
     * non traduite, comme le reste du fichier. Elle réutilise `weekdays`, dont
     * les entrées portent justement la chaîne source anglaise.
     */
    private describeExpiry (expiry: Settings['expiry']): string {
        if (expiry.mode === 'never') {
            return 'no expiry'
        }
        if (expiry.mode === 'sliding') {
            return `${expiry.days} day(s) after entry`
        }
        const day = this.weekdays.find(d => d.value === expiry.weekday)?.source ?? '?'
        return `every ${day} at ${expiry.hour}:00`
    }
}
