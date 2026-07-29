/**
 * Accès au keychain natif de l'OS via `safeStorage` du processus principal.
 *
 * `safeStorage` n'existe pas dans le renderer : il faut passer par
 * `@electron/remote`, que le chargeur de plugins de Tabby rend résolvable en
 * ajoutant `<app.asar>/node_modules` au NODE_PATH
 * (.AIRules/AI-CONTEXT.html, piège #V7).
 *
 * TOUT accès au trousseau passe par `withSafeStorage()`, qui l'enveloppe dans
 * le garde-fou de `keychainGuard.ts` — voir l'en-tête de ce fichier pour le
 * pourquoi. Ne jamais appeler `require('@electron/remote')` directement
 * ailleurs : le garde-fou ne protège que ce qu'il enveloppe.
 */

import { runGuarded, isSuspendedError } from './keychainGuard'

/**
 * Champs optionnels plutôt qu'union discriminée : le tsconfig de ce projet
 * (aligné sur celui du projet frère) n'active pas `strict`, et sans
 * `strictNullChecks` TypeScript n'affine pas les unions sur un littéral
 * booléen.
 */
export interface KeychainStatus {
    available: boolean
    /** Renseigné si `available` — nom du backend de stockage retenu. */
    backend?: string
    /** Renseigné si `!available` — cause, destinée au journal. */
    reason?: string
    /**
     * Le refus vient du garde-fou, pas du trousseau lui-même : l'utilisateur
     * peut le lever depuis les réglages. Une panne ordinaire, non.
     */
    suspended?: boolean
}

/**
 * Point de passage unique vers `safeStorage`.
 *
 * `label` étiquette l'opération dans le témoin du garde-fou : c'est ce que
 * l'utilisateur lira si un gel survient, et le seul indice de l'endroit exact
 * où le trousseau a cessé de répondre.
 */
function withSafeStorage<T> (label: string, fn: (safeStorage: any) => T): T {
    return runGuarded(label, () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const remote = require('@electron/remote')
        const safeStorage = remote?.safeStorage
        if (!safeStorage) {
            throw new Error('@electron/remote ou safeStorage inaccessible')
        }
        return fn(safeStorage)
    })
}

/**
 * Le chiffrement de l'OS est-il réellement disponible ET digne de confiance ?
 *
 * Sur Linux, `safeStorage` retombe sur le backend `basic_text` quand aucun
 * service Secret n'est joignable. Dans ce mode, la clé est dérivée d'un mot de
 * passe codé en dur avec le sel fixe « saltysalt » et UNE seule itération de
 * PBKDF2 : le chiffrement est purement décoratif et n'importe qui peut relire
 * le jeton. On refuse donc explicitement ce backend plutôt que d'offrir à
 * l'utilisateur une fausse impression de sécurité.
 *
 * L'ORDRE DES TESTS COMPTE, et il est contre-intuitif. On a longtemps supposé
 * qu'`isEncryptionAvailable()` restait `true` en mode dégradé, d'où un test de
 * disponibilité placé en premier. C'est faux : mesuré sur Electron 38.8.6
 * (Tabby 1.0.235, Ubuntu, `--password-store=basic`), la méthode renvoie déjà
 * `false` dès que le backend retenu est `basic_text`. Le test générique sortait
 * donc systématiquement en premier, et le motif ci-dessous — le seul qui
 * explique *pourquoi* ce mode n'est pas fiable — n'était jamais affiché :
 * l'utilisateur lisait « le système n'offre pas de chiffrement », un message
 * exact mais inexploitable.
 *
 * SUR LINUX, LE BACKEND SUFFIT : `isEncryptionAvailable()` n'y est plus appelé
 * du tout quand `getSelectedStorageBackend()` a répondu autre chose que
 * `basic_text`. Il n'apportait aucune information que le backend ne donne déjà,
 * et c'est l'appel dont on a MESURÉ qu'il gèle sur trousseau verrouillé. Il
 * reste le seul test possible là où `getSelectedStorageBackend` n'existe pas
 * (Windows, macOS) et sur les Electron antérieurs à ce changement.
 *
 * Attention à ne pas lire ce raccourci comme un correctif du gel : il retire un
 * appel bloquant du chemin, pas le risque. `encryptString`/`decryptString`
 * déclenchent la même acquisition de clé OSCrypt et bloquent selon toute
 * vraisemblance de la même façon. C'est le garde-fou qui répond de ce cas, pas
 * l'ordre des tests.
 */
export function keychainStatus (): KeychainStatus {
    try {
        return withSafeStorage('diagnostic du trousseau', safeStorage => {
            if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend) {
                const backend = String(safeStorage.getSelectedStorageBackend())
                if (backend === 'basic_text') {
                    return {
                        available: false,
                        reason: 'trousseau Linux indisponible (backend basic_text : clé codée en dur, chiffrement non fiable)',
                    }
                }
                return { available: true, backend }
            }
            if (!safeStorage.isEncryptionAvailable()) {
                return { available: false, reason: "le système n'offre pas de chiffrement (isEncryptionAvailable=false)" }
            }
            return { available: true, backend: 'natif' }
        })
    } catch (e) {
        if (isSuspendedError(e)) {
            return { available: false, suspended: true, reason: String((e as Error).message) }
        }
        return { available: false, reason: `safeStorage inutilisable — ${String(e)}` }
    }
}

/** Nom du coffre de l'OS, tel qu'il est connu de l'utilisateur. */
export function keychainLabel (): string {
    if (process.platform === 'win32') {
        return "le gestionnaire d'identifiants de Windows"
    }
    if (process.platform === 'darwin') {
        return 'le trousseau de macOS'
    }
    return 'le trousseau du système'
}

export function encrypt (plaintext: string): Buffer {
    return withSafeStorage('enregistrement du mot de passe', s => s.encryptString(plaintext))
}

export function decrypt (blob: Buffer): string {
    return withSafeStorage('relecture du mot de passe', s => s.decryptString(blob))
}
