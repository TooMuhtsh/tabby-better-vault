import { Injectable, Injector } from '@angular/core'
import { ProfileProvider } from 'tabby-core'

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
 * NE JAMAIS FAIRE `require('tabby-ssh')` DEPUIS CE PLUGIN. Le chargeur de Tabby
 * n'intercepte par NOM que `@angular/*`, `rxjs`, `ngx-toastr`, `zone.js` et
 * quatre modules Tabby — `tabby-core`, `tabby-local`, `tabby-settings`,
 * `tabby-terminal` (`cachedBuiltinModules` + `builtinModules` de son
 * `initModuleLookup`). `tabby-ssh` N'EN FAIT PAS PARTIE : requis par nom depuis
 * ce plugin, Node le résout dans NOTRE `node_modules` (visible à l'exécution à
 * travers la jonction NTFS) et charge une SECONDE copie du module. Sa classe
 * `PasswordStorageService` étant `providedIn: 'root'`, l'injecteur crée alors
 * sans broncher un JUMEAU du singleton — que personne d'autre n'utilise : le
 * patch se pose dessus et ne se déclenche jamais. Mesuré en conditions réelles
 * le 2026-08-07, lors de la première passe de test de ce chantier.
 *
 * L'ACQUISITION PASSE DONC PAR L'INJECTEUR SEUL : le multi-provider
 * `ProfileProvider` de `tabby-core` (intercepté par nom, donc toujours le vrai),
 * dont l'entrée `id === 'ssh'` détient l'instance réelle dans son champ
 * `passwordStorage`. Vérifié en live par l'injecteur : c'est bien l'instance
 * que `SSHService` et les sessions utilisent. Bénéfice collatéral : plus aucune
 * dépendance de chargement sur `tabby-ssh` — sans lui, l'entrée `ssh` manque et
 * ce service se retire proprement.
 *
 * PATTERN NON CONTRACTUEL, au même titre que #V2 : le nom du champ
 * `passwordStorage` et la signature `loadPassword(profile, username)` sortent
 * du bundle installé (`tabby-ssh@1.0.231-nightly.0`), pas d'une API — les
 * typings npm, eux, MENTENT deux fois (classe non réexportée, second paramètre
 * absent). À revérifier à chaque mise à jour de Tabby.
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
 * Surface réellement consommée, décrite d'après le BUNDLE INSTALLÉ (voir
 * ci-dessus — les typings ne sont pas fiables ici, et ce fichier n'importe plus
 * rien de `tabby-ssh`). Volontairement minimale.
 */
interface SSHProfileLike {
    id?: string
}

interface PasswordStorage {
    loadPassword (profile: SSHProfileLike, username?: string): Promise<string | null>
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
            const providers = this.injector.get<unknown>(ProfileProvider as any, [])
            const list = Array.isArray(providers) ? providers : [providers]
            const ssh = list.find((p: any) => p?.id === 'ssh') as any
            const candidate = ssh?.passwordStorage
            if (!candidate || typeof candidate.loadPassword !== 'function') {
                // `tabby-ssh` absent, ou son provider ne détient plus le champ :
                // pas d'exclusions, mais un plugin par ailleurs intact. Le dire
                // en CRIT — sans cette trace, une exclusion réglée puis sans
                // effet serait indéboguable.
                crit('per-profile exclusions unavailable: no ssh profile provider exposing passwordStorage — has Tabby changed?')
                return
            }
            storage = candidate
        } catch (e) {
            crit(`per-profile exclusions unavailable — ${briefError(e)}`)
            return
        }

        this.installed = true
        const original = storage.loadPassword.bind(storage)

        storage.loadPassword = async (profile: SSHProfileLike, username?: string): Promise<string | null> => {
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
