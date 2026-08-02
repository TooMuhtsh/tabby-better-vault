import { Injectable, Injector } from '@angular/core'
import { ToastrService } from 'ngx-toastr'
import { AppService, VaultService } from 'tabby-core'

import { I18nService } from './i18n'
import { showInlineToast } from './inlineToast'
import { guardState, describeState } from './keychainGuard'
import { log, warn, crit } from './logger'
import { briefError, english, logDate } from './messages'
import { keychainStatus, keychainName, encrypt, decrypt } from './osKeychain'
import {
    readSettings, writeSettings, readToken, writeToken, deleteToken,
    cleanUpLegacyToken, tokenHasExpired, computeExpiry, Settings,
} from './store'
import { readStoredVault } from './tabbyConfig'
import { passphraseOpensVault } from './vaultCrypto'

/**
 * Remplace `VaultService.getPassphrase` pour servir le mot de passe maître
 * depuis le keychain de l'OS.
 *
 * Tabby n'expose aucune API d'injection : le cache `_rememberedPassphrase` est
 * une variable de portée module, délibérément inaccessible (piège #V2). Le
 * remplacement de la méthode sur l'instance est donc le seul levier — c'est
 * aussi ce que fait le plugin tabby-vault-keepassxc.
 *
 * DISCIPLINE DU SECRET : le mot de passe en clair ne doit jamais être conservé.
 * Il ne vit que dans les variables locales de `resolve()` et disparaît avec
 * elle. Aucun champ de cette classe ne le contient, il n'est jamais journalisé,
 * jamais écrit ailleurs que chiffré par l'OS.
 */
const UNLOCK_MESSAGE = 'Vault unlocked automatically'

@Injectable({ providedIn: 'root' })
export class VaultBridgeService {
    private installed = false
    private original: (() => Promise<string>) | null = null
    /** Conservé pour interroger `isOpen()` — voir previewOnly(). */
    private vault: VaultService | null = null
    /** Le jeton courant a déjà passé la vérification PBKDF2 (coûteuse). */
    private tokenVerified = false
    /** Sérialise nos propres résolutions, comme Tabby le fait pour la sienne. */
    private pending: Promise<string> | null = null
    /**
     * Le coffre est déverrouillé plusieurs fois par démarrage (trois appels en
     * une seconde en usage réel). Une seule notification par session : au-delà,
     * elle cesserait d'informer pour devenir une nuisance.
     */
    private unlockAnnounced = false

    constructor (
        private injector: Injector,
        private toastr: ToastrService,
        private i18n: I18nService,
    ) { }

    install (): void {
        if (this.installed) {
            return
        }

        let vault: VaultService
        try {
            vault = this.injector.get(VaultService)
        } catch (e) {
            crit(`cannot install: VaultService not found — ${String(e)}`)
            return
        }

        this.installed = true
        this.vault = vault
        this.original = vault.getPassphrase.bind(vault)
        cleanUpLegacyToken()

        vault.getPassphrase = (): Promise<string> => {
            if (!this.pending) {
                this.pending = this.resolve().finally(() => {
                    this.pending = null
                })
            }
            return this.pending
        }

        // AUCUN ACCÈS AU TROUSSEAU ICI. Cette méthode est appelée depuis le
        // constructeur du NgModule, donc sur le chemin de démarrage de Tabby, et
        // AVANT même que `enabled` ne soit consulté — le test vit dans
        // `resolve()`. Un `keychainStatus()` à cet endroit, qui n'y servait qu'à
        // journaliser, gelait Tabby à son écran de démarrage sur trousseau
        // verrouillé, y compris quand le plugin était désactivé : la simple
        // présence du plugin suffisait. Défaut de sévérité haute relevé par la
        // campagne du 2026-07-29, contraire au principe fondateur du plugin.
        //
        // Le diagnostic est désormais fait dans `resolve()`, c'est-à-dire une
        // fois `enabled` vérifié, et sous garde-fou. Plugin désactivé = zéro
        // contact avec le trousseau, garanti par la structure et non par un
        // `try/catch` (qui n'attrape rien face à un appel bloquant).
        const guard = guardState()
        if (guard.suspended) {
            // Le garde-fou s'est déclenché : sans cette trace, l'utilisateur ne
            // pourrait pas comprendre pourquoi le déverrouillage automatique a
            // cessé de fonctionner du jour au lendemain.
            crit(`bridge installed, but keychain access is suspended — ${english(describeState(guard))}; lift it in Settings → Better Vault`)
        } else {
            log('bridge installed — the keychain will only be queried at the first unlock')
        }
    }

    /**
     * Lu depuis notre propre fichier, JAMAIS depuis ConfigService : quand la
     * config est chiffrée, elle n'est pas encore déchiffrable à l'instant où
     * cette méthode est appelée — et elle ne le sera qu'une fois le mot de passe
     * fourni, c'est-à-dire par nous. Voir piège #V11.
     */
    private get settings (): Settings {
        return readSettings()
    }

    /**
     * Appelle la méthode native de Tabby : la pop-up s'affiche et l'utilisateur
     * saisit son mot de passe. C'est le comportement de repli en toute
     * circonstance — jamais d'erreur bloquante due à ce plugin.
     */
    private callOriginal (): Promise<string> {
        if (!this.original) {
            throw new Error('the native method has been lost')
        }
        return this.original()
    }

    private async resolve (): Promise<string> {
        const { enabled, debug } = this.settings

        if (debug) {
            log('observation mode: delegating to the native prompt, capturing nothing')
            return this.previewOnly()
        }
        if (!enabled) {
            return this.callOriginal()
        }

        // Premier contact avec le trousseau, et le plus tôt possible dans la vie
        // du plugin : ici `enabled` est vrai, donc l'utilisateur a explicitement
        // demandé ce contact. Tout ce qui précède s'en passe.
        const status = keychainStatus()
        if (status.suspended) {
            // Distinct d'une indisponibilité ordinaire : l'état persiste d'un
            // démarrage à l'autre et ne se lèvera pas tout seul. Le message doit
            // donc dire quoi faire, pas seulement ce qui ne va pas.
            crit(`${status.reason ? english(status.reason) : 'keychain access suspended'} — manual entry; lift it in Settings → Better Vault once the keychain is unlocked`)
            return this.callOriginal()
        }
        if (!status.available) {
            warn(`keychain unavailable (${status.reason ? english(status.reason) : 'no reason given'}) — manual entry`)
            return this.callOriginal()
        }

        const served = await this.serveFromToken()
        if (served !== null) {
            return served
        }
        return this.learnFromUser()
    }

    /** Déverrouillage automatique : jeton présent, non expiré, vérifié, servi. */
    private async serveFromToken (): Promise<string | null> {
        const settings = this.settings
        if (settings.token && tokenHasExpired(settings)) {
            warn('token expired under the configured policy — purged, manual entry')
            deleteToken()
            this.tokenVerified = false
            return null
        }

        // Jeton enregistré avant qu'une politique d'expiration ne soit définie
        // (ou sous « jamais », puis la politique a changé) : on lui en attribue
        // une maintenant, sinon il resterait éternellement valide alors que les
        // réglages affichent une échéance.
        if (settings.token && settings.tokenExpiresAt === null && settings.expiry.mode !== 'never') {
            const expiresAt = computeExpiry(settings.expiry)
            writeSettings({ ...settings, tokenExpiresAt: expiresAt })
            log(`expiry applied to the existing token: ${expiresAt ? logDate(expiresAt) : 'none'}`)
        }

        const blob = readToken()
        if (!blob) {
            return null
        }

        let passphrase: string
        try {
            passphrase = decrypt(blob)
        } catch (e) {
            warn(`token unreadable (${String(e)}) — purged, manual entry`)
            deleteToken()
            this.tokenVerified = false
            return null
        }

        // Vérification une seule fois par jeton : 100 000 itérations de PBKDF2
        // coûtent ~50-100 ms, et getPassphrase() est sur le chemin de démarrage.
        if (!this.tokenVerified) {
            const store = readStoredVault()
            if (!store) {
                // Pas de coffre lisible dans config.yaml : rien à vérifier
                // contre. On préfère ne rien servir plutôt que de servir un
                // mot de passe non validé.
                warn('no vault found in config.yaml — manual entry')
                return null
            }
            if (!await passphraseOpensVault(store, passphrase)) {
                warn('stale token (has the master password changed?) — purged, manual entry')
                deleteToken()
                this.tokenVerified = false
                return null
            }
            this.tokenVerified = true
            log('token verified')
        }

        log('vault unlocked from the system keychain')
        this.announceUnlock()
        return passphrase
    }

    /**
     * Signale discrètement que le plugin vient d'agir. Sans cela, un
     * déverrouillage réussi est indiscernable d'un coffre qui n'aurait jamais
     * été verrouillé — le plugin ne se manifeste que lorsqu'il échoue.
     */
    private announceUnlock (): void {
        if (this.unlockAnnounced) {
            return
        }
        this.unlockAnnounced = true

        if (showInlineToast(this.i18n.t(UNLOCK_MESSAGE))) {
            return
        }

        // Au démarrage, le coffre est déverrouillé avant qu'un onglet n'existe :
        // il n'y a alors rien où afficher. On attend le premier onglet actif
        // plutôt que de retomber sur une notification globale, qui irait contre
        // l'intention — la notification doit appartenir au terminal.
        this.showWhenTabAvailable()
    }

    private showWhenTabAvailable (): void {
        let app: AppService
        try {
            app = this.injector.get(AppService)
        } catch {
            return
        }

        const subscription = app.activeTabChange$.subscribe(tab => {
            if (!tab) {
                return
            }
            // Laisse le corps de l'onglet se rendre avant d'y insérer quoi que
            // ce soit : `activeTabChange$` précède l'apparition du DOM.
            setTimeout(() => {
                if (showInlineToast(this.i18n.t(UNLOCK_MESSAGE))) {
                    subscription.unsubscribe()
                }
            }, 150)
        })

        // Sans onglet dans ce délai, on renonce : une notification qui
        // surgirait bien plus tard n'aurait plus de rapport visible avec le
        // déverrouillage.
        setTimeout(() => subscription.unsubscribe(), 30000)
    }

    /**
     * Mode observation : rien n'est capturé ni enregistré, mais on montre ce
     * qui se serait produit — sans quoi ce mode ne permettrait pas de juger du
     * résultat avant de confier son mot de passe pour de bon.
     *
     * L'aperçu n'est affiché que si l'utilisateur vient réellement de saisir son
     * mot de passe. `isOpen()` distingue les deux cas : faux avant l'appel, le
     * cache natif était vide, donc la pop-up s'est bien affichée ; vrai, l'appel
     * a été servi depuis le cache sans rien demander, et une notification
     * n'aurait aucun sens.
     */
    private async previewOnly (): Promise<string> {
        const wasOpen = this.vault?.isOpen() ?? false
        const passphrase = await this.callOriginal()
        if (!wasOpen) {
            this.announceStorage(computeExpiry(this.settings.expiry), true)
        }
        return passphrase
    }

    /**
     * Premier usage : l'utilisateur saisit son mot de passe dans la pop-up
     * native, et on le confie au keychain pour les fois suivantes.
     */
    private async learnFromUser (): Promise<string> {
        const passphrase = await this.callOriginal()

        // VALIDER AVANT D'ENREGISTRER, ET SURTOUT AVANT D'ANNONCER.
        //
        // Cette vérification manquait : une phrase erronée était chiffrée,
        // écrite, et annoncée comme « enregistrée » — au moment précis où Tabby
        // affichait « Could not decrypt config — BAD_DECRYPT » pour la même
        // saisie. Mesuré par la campagne du 2026-07-29 (défaut D2). La
        // dégradation restait sûre au démarrage suivant, `serveFromToken()`
        // purgeant le jeton invalide, mais l'utilisateur recevait une
        // confirmation contredite à l'écran au même instant.
        //
        // Symétrie voulue avec `serveFromToken()` : coffre illisible, on
        // n'enregistre rien. Refuser de servir ce qu'on n'a pas pu vérifier et
        // accepter d'enregistrer ce qu'on n'a pas pu vérifier ne se défendent
        // pas ensemble.
        const store = readStoredVault()
        if (!store) {
            warn('no vault found in config.yaml — password not saved, nothing to verify it against')
            return passphrase
        }
        if (!await passphraseOpensVault(store, passphrase)) {
            warn('the password entered does not open the vault — not saved')
            return passphrase
        }

        try {
            const expiresAt = writeToken(encrypt(passphrase))
            this.tokenVerified = true
            log(`password saved in the system keychain — expires: ${expiresAt ? logDate(expiresAt) : 'never'}`)
            this.announceStorage(expiresAt)
        } catch (e) {
            // Échec d'enregistrement : sans conséquence pour l'utilisateur, il
            // ressaisira au prochain démarrage.
            // `briefError` et non `String(e)` : cette erreur vient de
            // `safeStorage`, donc de l'autre processus, et porte sa pile dans son
            // message. Neuf lignes pour une entrée de journal dont la rétention
            // raisonne par ligne.
            warn(`could not save to the keychain — ${briefError(e)}`)
        }
        return passphrase
    }

    /**
     * Prévient l'utilisateur que son mot de passe vient d'être confié à l'OS.
     *
     * Ce plugin capte un secret : le stockage ne doit jamais être silencieux.
     * L'utilisateur doit savoir ce qui a été enregistré, jusqu'à quand, et
     * comment revenir en arrière — le tout au moment précis où ça se produit,
     * pas enfoui dans un panneau de réglages qu'il n'ouvrira peut-être jamais.
     */
    private announceStorage (expiresAt: number | null, preview = false): void {
        // PHRASES ENTIÈRES, JAMAIS ASSEMBLÉES. Ce corps de notification était
        // composé d'un fragment « valable jusqu'au … » suivi d'un autre : une
        // fois traduits, ces morceaux ne se recollent pas — l'ordre des mots et
        // les accords diffèrent d'une langue à l'autre, et un traducteur qui ne
        // voit qu'un fragment ne peut pas le rendre correctement. Les quatre
        // combinaisons sont donc écrites en toutes lettres.
        const keychain = this.i18n.t(keychainName())
        // Locale de Tabby, pas celle du système : cette notification est traduite,
        // la date qu'elle porte doit l'être avec elle.
        const date = expiresAt ? this.i18n.date(expiresAt) : null

        const title = preview
            ? this.i18n.t('Observation mode — nothing was saved')
            : this.i18n.t('Password saved in {keychain}', { keychain })

        let body: string
        if (preview) {
            body = date
                ? this.i18n.t('Outside observation mode, the password would be entrusted to {keychain}. Valid until {date}.', { keychain, date })
                : this.i18n.t('Outside observation mode, the password would be entrusted to {keychain}. Valid until revoked.', { keychain })
        } else {
            body = date
                ? this.i18n.t('Valid until {date}. Can be revoked at any time in Settings → Better Vault.', { date })
                : this.i18n.t('Valid until you revoke it, at any time in Settings → Better Vault.')
        }

        try {
            this.toastr.info(
                body,
                title,
                {
                    timeOut: 12000,
                    extendedTimeOut: 4000,
                    // `toastClass` REMPLACE la classe par défaut au lieu de s'y
                    // ajouter : conserver `ngx-toastr` est indispensable, sinon
                    // le toast perd sa mise en forme de base.
                    toastClass: 'ngx-toastr better-vault-toast',
                },
            )
        } catch (e) {
            // Une notification qui échoue ne doit pas compromettre le
            // déverrouillage lui-même.
            warn(`could not display the notification — ${String(e)}`)
        }
    }
}
