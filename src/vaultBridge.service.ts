import { Injectable, Injector } from '@angular/core'
import { VaultService } from 'tabby-core'

import { log } from './logger'
import { keychainStatus, encrypt, decrypt } from './osKeychain'
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
@Injectable({ providedIn: 'root' })
export class VaultBridgeService {
    private installed = false
    private original: (() => Promise<string>) | null = null
    /** Le jeton courant a déjà passé la vérification PBKDF2 (coûteuse). */
    private tokenVerified = false
    /** Sérialise nos propres résolutions, comme Tabby le fait pour la sienne. */
    private pending: Promise<string> | null = null

    constructor (private injector: Injector) { }

    install (): void {
        if (this.installed) {
            return
        }

        let vault: VaultService
        try {
            vault = this.injector.get(VaultService)
        } catch (e) {
            log(`installation impossible : VaultService introuvable — ${String(e)}`)
            return
        }

        this.installed = true
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

        const status = keychainStatus()
        const { machineName, enabled } = this.settings
        log(`installé sur « ${machineName} » — plugin ${enabled ? 'actif' : 'inactif'} — keychain : ${status.available ? `disponible (${status.backend})` : `INDISPONIBLE (${status.reason})`}`)
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
            throw new Error('méthode native perdue')
        }
        return this.original()
    }

    private async resolve (): Promise<string> {
        const { enabled, debug } = this.settings

        if (debug) {
            log('mode observation : délégation à la pop-up native, aucune capture')
            return this.callOriginal()
        }
        if (!enabled) {
            return this.callOriginal()
        }

        const status = keychainStatus()
        if (!status.available) {
            log(`keychain indisponible (${status.reason}) — saisie manuelle`)
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
            log('jeton arrivé à échéance — purge et saisie manuelle')
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
            log(`échéance appliquée au jeton existant : ${expiresAt ? new Date(expiresAt).toLocaleString() : 'aucune'}`)
        }

        const blob = readToken()
        if (!blob) {
            return null
        }

        let passphrase: string
        try {
            passphrase = decrypt(blob)
        } catch (e) {
            log(`jeton illisible (${String(e)}) — purge et saisie manuelle`)
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
                log('coffre introuvable dans config.yaml — saisie manuelle')
                return null
            }
            if (!await passphraseOpensVault(store, passphrase)) {
                log('jeton périmé (le mot de passe maître a changé ?) — purge et saisie manuelle')
                deleteToken()
                this.tokenVerified = false
                return null
            }
            this.tokenVerified = true
            log('jeton vérifié')
        }

        log('coffre déverrouillé depuis le keychain de l\'OS')
        return passphrase
    }

    /**
     * Premier usage : l'utilisateur saisit son mot de passe dans la pop-up
     * native, et on le confie au keychain pour les fois suivantes.
     */
    private async learnFromUser (): Promise<string> {
        const passphrase = await this.callOriginal()
        try {
            const expiresAt = writeToken(encrypt(passphrase))
            this.tokenVerified = true
            log(`mot de passe confié au keychain de l'OS — échéance : ${expiresAt ? new Date(expiresAt).toLocaleString() : 'aucune'}`)
        } catch (e) {
            // Échec d'enregistrement : sans conséquence pour l'utilisateur, il
            // ressaisira au prochain démarrage.
            log(`enregistrement dans le keychain impossible — ${String(e)}`)
        }
        return passphrase
    }
}
