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
 * Sur Linux, `safeStorage` retombe silencieusement sur le backend `basic_text`
 * quand aucun trousseau reconnu n'est détecté — ce qui arrive avec des
 * gestionnaires de fenêtres courants (Sway, i3, Hyprland, bspwm…). Dans ce
 * mode, la clé est dérivée d'un mot de passe codé en dur avec le sel fixe
 * « saltysalt » et UNE seule itération de PBKDF2 : le chiffrement est purement
 * décoratif et n'importe qui peut relire le jeton.
 *
 * On refuse donc explicitement ce backend plutôt que d'offrir à l'utilisateur
 * une fausse impression de sécurité.
 */
export function keychainStatus (): KeychainStatus {
    const safeStorage = getSafeStorage()
    if (!safeStorage) {
        return { available: false, reason: '@electron/remote ou safeStorage inaccessible' }
    }
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            return { available: false, reason: "le système n'offre pas de chiffrement (isEncryptionAvailable=false)" }
        }
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
        return { available: true, backend }
    } catch (e) {
        return { available: false, reason: `safeStorage inutilisable — ${String(e)}` }
    }
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
