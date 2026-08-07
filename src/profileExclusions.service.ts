import { Injectable, Injector } from '@angular/core'
import type { SSHProfile } from 'tabby-ssh'

import { log, crit } from './logger'
import { briefError } from './messages'
import { isProfileExcluded } from './store'
import { VaultBridgeService } from './vaultBridge.service'

/**
 * Rend la pop-up native à l'utilisateur pour les profils qu'il a exclus —
 * granularité par profil, `.AIRules/ROADMAP.html#granularite`.
 *
 * POURQUOI CE POINT D'INTERCEPTION, ET PAS LE PONT LUI-MÊME.
 * `VaultService.getPassphrase()` est aveugle : aucun argument, et l'identité du
 * profil est déjà détruite quand elle est appelée. Le dernier endroit où le
 * profil existe encore en entier est `PasswordStorageService.loadPassword()` de
 * `tabby-ssh` — juste après, `getVaultKeyForConnection()` le réduit à
 * `{ user, host, port }` pour indexer le secret dans le coffre, et l'id de
 * profil n'existe plus nulle part sur le chemin. Constat de la passe de
 * faisabilité du 2026-08-07, relevé dans le bundle installé.
 *
 * D'où la structure : ce service enveloppe `loadPassword()` et, sur un profil
 * exclu, ouvre une fenêtre de délégation (`runWithNativePrompt()`) pendant
 * laquelle le pont refuse de servir la passphrase automatiquement. La pop-up
 * native de Tabby s'affiche donc pour cette connexion-là, et pour elle seule.
 *
 * PATTERN NON CONTRACTUEL, au même titre que #V2 : remplacement d'une méthode
 * sur l'instance d'un service interne, vérifié aux deux niveaux sur
 * `tabby-ssh@1.0.231-nightly.0` uniquement — à revérifier à chaque mise à jour
 * de Tabby.
 *
 * LES TYPINGS NPM NE DÉCRIVENT PAS CE QUI EST INSTALLÉ. Deux écarts constatés au
 * moment d'écrire ce fichier, d'où le `require` et l'interface locale ci-dessous
 * plutôt qu'un import typé :
 *
 *   1. `PasswordStorageService` n'est PAS réexporté par
 *      `tabby-ssh/typings/index.d.ts` (qui ne fait qu'`export * from './api'`),
 *      alors que le bundle compilé l'expose bien dans son bloc de réexport
 *      webpack. Un `import { PasswordStorageService } from 'tabby-ssh'` échoue à
 *      la compilation tout en étant parfaitement valide à l'exécution.
 *   2. Les typings déclarent `loadPassword(profile)` à UN paramètre, quand le
 *      code installé en prend DEUX — `loadPassword(profile, username)`, le
 *      second servant à résoudre le compte quand il diffère de
 *      `profile.options.user` (authentification interactive, jump host, WinSCP).
 *      Se fier aux typings ferait perdre ce paramètre en cours de route, donc
 *      changerait la clé de recherche du secret : le déverrouillage retomberait
 *      silencieusement sur le mauvais compte.
 *
 * LIMITES ASSUMÉES, et qui doivent être dites à l'interface plutôt que cachées :
 *
 *   - CLÉS PRIVÉES HORS PÉRIMÈTRE. `loadPrivateKeyPassword()` est indexée par
 *     hash du fichier de clé, pas par profil : une clé partagée entre plusieurs
 *     profils est indistinguable, l'exclusion ne peut pas s'y appliquer.
 *   - DÉMARRAGE EN CONFIG CHIFFRÉE. Cette sollicitation-là n'a pas de profil —
 *     elle précède l'existence de tout onglet, et de la liste des profils
 *     elle-même. Le déverrouillage au boot reste automatique.
 *   - JUMP HOSTS. Le coffre est sollicité pour le profil du *jump*, pas pour
 *     celui que l'utilisateur voit s'ouvrir : exclure le second ne suffit pas.
 *
 * Et ce que ce mécanisme n'est PAS : un cloisonnement des secrets. Le coffre
 * reste un blob chiffré unique, et n'importe quel profil non exclu rouvre le
 * service automatique pour tout le monde.
 */

/**
 * Surface réellement patchée, décrite d'après le BUNDLE INSTALLÉ et non d'après
 * les typings (voir l'écart n°2 ci-dessus). Volontairement minimale : tout ce
 * qui n'est pas enveloppé n'a pas à figurer ici.
 */
interface PasswordStorage {
    loadPassword (profile: SSHProfile, username?: string): Promise<string | null>
}

@Injectable({ providedIn: 'root' })
export class ProfileExclusionsService {
    private installed = false

    constructor (
        private injector: Injector,
        private bridge: VaultBridgeService,
    ) { }

    install (): void {
        if (this.installed) {
            return
        }

        let storage: PasswordStorage
        try {
            // `require` et non `import` de valeur POUR LA SEULE RAISON que le
            // symbole manque aux typings (écart n°1) — pas pour retarder quoi que
            // ce soit. Ne pas se méprendre sur cette forme : la sortie est en
            // UMD, et webpack hisse TOUS les externals dans l'en-tête du module,
            // y compris ceux écrits en `require` au fond d'une fonction (c'est
            // déjà le cas de `@electron/remote`, vérifié dans `dist/index.js`).
            // `tabby-ssh` devient donc une dépendance de CHARGEMENT de ce plugin,
            // au même titre que `tabby-settings` — un autre plugin intégré, déjà
            // présent dans cet en-tête sans que cela ait jamais posé problème.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { PasswordStorageService } = require('tabby-ssh')
            storage = this.injector.get(PasswordStorageService) as PasswordStorage
        } catch (e) {
            // Couvre ce que l'en-tête UMD ne couvre pas : le service absent de
            // l'injecteur, renommé ou déplacé par une mise à jour de Tabby.
            // Jamais d'exception qui remonte — ce service est installé depuis le
            // constructeur du NgModule, sur le chemin de démarrage de Tabby.
            // Sans exclusions, le plugin fonctionne exactement comme avant.
            crit(`per-profile exclusions unavailable: PasswordStorageService not found — ${briefError(e)}`)
            return
        }

        this.installed = true
        const original = storage.loadPassword.bind(storage)

        storage.loadPassword = async (profile: SSHProfile, username?: string): Promise<string | null> => {
            let excluded = false
            try {
                // `profile?.id` et non `profile.id` : le type promet un objet,
                // l'exécution ne promet rien — cette méthode est appelée depuis
                // une demi-douzaine d'endroits de tabby-ssh, dont certains
                // manipulent des profils partiels.
                excluded = !!profile?.id && isProfileExcluded(profile.id)
            } catch (e) {
                // TOUTE ANOMALIE VAUT « NON EXCLU ». Fichier d'état illisible,
                // entrée corrompue, disque indisponible : rien de tout cela ne
                // doit empêcher un déverrouillage. La règle de la fiche est
                // explicite, et elle va dans le sens du principe fondateur du
                // plugin — un confort ne bloque jamais.
                crit(`could not read the exclusion list — treating the profile as not excluded (${briefError(e)})`)
                excluded = false
            }

            if (!excluded) {
                return original(profile, username)
            }

            // L'id de profil peut apparaître dans le journal local : c'est un
            // identifiant de configuration, jamais un secret. Aucun mot de
            // passe ici, ni sa longueur, ni rien qui s'en approche.
            log(`profile ${profile.id} is excluded — the native prompt will be used for this connection`)
            return this.bridge.runWithNativePrompt(() => original(profile, username))
        }

        // PAS DE TEST DE `enabled` ICI, ni maintenant ni à l'appel. L'enveloppe
        // est neutre quand le plugin est désactivé : `resolve()` délègue déjà à
        // la méthode native dans ce cas, si bien que la fenêtre de délégation ne
        // change rien. Conditionner l'installation obligerait en plus à la
        // rejouer au moindre changement de réglage, et à lire le fichier d'état
        // sur ce chemin de démarrage — deux complications sans contrepartie.
        log('per-profile exclusions installed')
    }
}
