/**
 * Accès au keychain natif de l'OS via `safeStorage` du processus principal.
 *
 * `safeStorage` n'existe pas dans le renderer : il faut passer par
 * `@electron/remote`, que le chargeur de plugins de Tabby rend résolvable en
 * ajoutant `<app.asar>/node_modules` au NODE_PATH
 * (.AIRules/AI-CONTEXT.html, piège #V7).
 */

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
}

function getSafeStorage (): any | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const remote = require('@electron/remote')
        return remote?.safeStorage ?? null
    } catch {
        return null
    }
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
 * Le backend est donc interrogé d'abord. Le test de disponibilité reste utile
 * derrière, pour les plateformes où `getSelectedStorageBackend` n'existe pas
 * (Windows, macOS) et pour les Electron antérieurs à ce changement.
 *
 * Ce que ce diagnostic ne couvre PAS : un trousseau présent mais *verrouillé*.
 * `getSelectedStorageBackend()` répond `gnome_libsecret` et
 * `isEncryptionAvailable()` répond `true`, alors que `encryptString` échouera à
 * l'usage. C'est le repli sur la méthode native de Tabby qui rattrape ce cas,
 * pas cette fonction.
 */
export function keychainStatus (): KeychainStatus {
    const safeStorage = getSafeStorage()
    if (!safeStorage) {
        return { available: false, reason: '@electron/remote ou safeStorage inaccessible' }
    }
    try {
        let backend = 'natif'
        if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend) {
            backend = String(safeStorage.getSelectedStorageBackend())
            if (backend === 'basic_text') {
                return {
                    available: false,
                    reason: 'trousseau Linux indisponible (backend basic_text : clé codée en dur, chiffrement non fiable)',
                }
            }
        }
        if (!safeStorage.isEncryptionAvailable()) {
            return { available: false, reason: "le système n'offre pas de chiffrement (isEncryptionAvailable=false)" }
        }
        return { available: true, backend }
    } catch (e) {
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
    const safeStorage = getSafeStorage()
    if (!safeStorage) {
        throw new Error('safeStorage indisponible')
    }
    return safeStorage.encryptString(plaintext)
}

export function decrypt (blob: Buffer): string {
    const safeStorage = getSafeStorage()
    if (!safeStorage) {
        throw new Error('safeStorage indisponible')
    }
    return safeStorage.decryptString(blob)
}
