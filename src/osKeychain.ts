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

import * as crypto from 'crypto'

import { runGuarded, isSuspendedError, suspendedMessage } from './keychainGuard'
import { GUARD, Message, OperationId, REASON } from './messages'

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
    /**
     * Renseigné si `!available` — cause, non rendue.
     *
     * Ce champ part à la fois au journal (en anglais) et à l'écran (traduit) :
     * il transporte donc sa chaîne source et ses paramètres plutôt qu'un texte.
     * Voir `messages.ts`.
     */
    reason?: Message
    /**
     * Le refus vient du garde-fou, pas du trousseau lui-même : l'utilisateur
     * peut le lever depuis les réglages. Une panne ordinaire, non.
     */
    suspended?: boolean
    /**
     * Le trousseau a réellement chiffré ET déchiffré, il ne s'est pas contenté
     * de se nommer. Seul `keychainRoundTrip()` pose ce drapeau — voir pourquoi
     * la distinction n'est pas cosmétique dans le commentaire de cette fonction.
     */
    verified?: boolean
}

/**
 * Point de passage unique vers `safeStorage`.
 *
 * `operation` étiquette l'appel dans le témoin du garde-fou : c'est ce que
 * l'utilisateur lira si un gel survient, et le seul indice de l'endroit exact
 * où le trousseau a cessé de répondre. Identifiant et non phrase — le témoin est
 * relu au démarrage suivant, éventuellement sous une autre locale.
 */
function withSafeStorage<T> (operation: OperationId, fn: (safeStorage: any) => T): T {
    return runGuarded(operation, () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const remote = require('@electron/remote')
        const safeStorage = remote?.safeStorage
        if (!safeStorage) {
            throw new Error('@electron/remote or safeStorage is unreachable')
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
 * bloquent identiquement — mesuré, plus supposé, par la campagne du 2026-07-29.
 * C'est le garde-fou qui répond de ce cas, pas l'ordre des tests.
 *
 * COROLLAIRE À NE PAS OUBLIER : sur Linux, un `available: true` rendu par cette
 * fonction ne dit RIEN de la capacité du trousseau à répondre — il ne fait que
 * rapporter son nom. Pour une vérification qui engage quelque chose, c'est
 * `keychainRoundTrip()` qu'il faut appeler, jamais celle-ci.
 */
export function keychainStatus (): KeychainStatus {
    try {
        return withSafeStorage('diagnose', safeStorage => {
            if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend) {
                const backend = String(safeStorage.getSelectedStorageBackend())
                if (backend === 'basic_text') {
                    return {
                        available: false,
                        reason: { source: REASON.backendBasicText },
                    }
                }
                return { available: true, backend }
            }
            if (!safeStorage.isEncryptionAvailable()) {
                return { available: false, reason: { source: REASON.noEncryption } }
            }
            return { available: true, backend: 'native' }
        })
    } catch (e) {
        if (isSuspendedError(e)) {
            return {
                available: false,
                suspended: true,
                reason: suspendedMessage(e) ?? { source: GUARD.anonymous },
            }
        }
        return { available: false, reason: { source: REASON.safeStorageUnusable, params: { error: String(e) } } }
    }
}

/** Valeur jetable de la sonde. N'a jamais rien de secret, par construction. */
const PROBE_PLAINTEXT = 'better-vault-probe'

/**
 * Vérification de bout en bout : chiffre puis déchiffre une valeur jetable.
 *
 * POURQUOI CETTE FONCTION EXISTE. `keychainStatus()` est délibérément bon
 * marché, et sur Linux il ne fait plus que lire le NOM du backend —
 * `getSelectedStorageBackend()`, dont la campagne du 2026-07-29 a mesuré qu'il
 * ne touche jamais le trousseau (0,00 s, aucun trafic D-Bus, verrou inchangé).
 * C'est ce qu'on veut sur le chemin de `resolve()`, où le vrai test est le
 * `decrypt()` qui suit.
 *
 * Mais c'était ruineux là où l'utilisateur DEMANDE une vérification. Le bouton
 * « Lever la suspension et vérifier » appelait `keychainStatus()` : sur un
 * trousseau verrouillé il annonçait « disponible », effaçait le témoin, et le
 * démarrage suivant regelait à l'identique. Mesuré par la deuxième campagne
 * (défaut D1, sévérité haute) : la garantie « le premier gel est le dernier »
 * était annulée par le seul chemin de sortie offert à l'utilisateur — qui lui
 * affirmait au passage que tout allait bien.
 *
 * CE QUE ÇA COÛTE, ET POURQUOI C'EST ACCEPTABLE ICI. Cet aller-retour peut
 * bloquer : c'est même tout l'intérêt, un test qui ne peut pas échouer ne teste
 * rien. Mais la même campagne a mesuré que le blocage n'est pas silencieux —
 * GNOME affiche une invite d'authentification, et l'appel rend la main en 4 à
 * 7 secondes dès qu'on y répond. L'utilisateur qui vient de cliquer
 * « vérifier » est devant son écran : pour lui, c'est une invite, pas un gel.
 * S'il s'en va, le témoin est armé et le démarrage suivant est protégé. À ne
 * jamais appeler hors d'une action explicite de l'utilisateur.
 */
export function keychainRoundTrip (): KeychainStatus {
    const status = keychainStatus()
    if (!status.available) {
        return status
    }
    try {
        return withSafeStorage('verify', safeStorage => {
            const blob = safeStorage.encryptString(PROBE_PLAINTEXT)
            if (safeStorage.decryptString(blob) !== PROBE_PLAINTEXT) {
                return {
                    available: false,
                    reason: { source: REASON.roundTripMismatch },
                }
            }
            return { ...status, verified: true }
        })
    } catch (e) {
        if (isSuspendedError(e)) {
            return {
                available: false,
                suspended: true,
                reason: suspendedMessage(e) ?? { source: GUARD.anonymous },
            }
        }
        return { available: false, reason: { source: REASON.roundTripFailed, params: { error: String(e) } } }
    }
}

/**
 * Nom du coffre de l'OS, tel qu'il est connu de l'utilisateur.
 *
 * Chaîne source anglaise, destinée aux notifications : c'est l'appelant qui la
 * traduit. Ces noms sont ceux que l'éditeur du système emploie lui-même, et une
 * traduction doit reprendre le terme officiel de la locale visée plutôt que de
 * traduire mot à mot.
 */
export function keychainName (): string {
    if (process.platform === 'win32') {
        return 'the Windows Credential Manager'
    }
    if (process.platform === 'darwin') {
        return 'the macOS Keychain'
    }
    return 'the system keychain'
}

/**
 * Longueur fixe, en caractères hexadécimaux, du sel préfixé au texte clair —
 * voir `encrypt()`. Fixe pour que `decrypt()` puisse le retrancher sans
 * séparateur, quel que soit le contenu du mot de passe lui-même.
 */
const SALT_LENGTH = 16

function randomSalt (): string {
    return crypto.randomBytes(SALT_LENGTH / 2).toString('hex')
}

/**
 * `safeStorage` chiffre de façon DÉTERMINISTE sur Linux : la clé dérivée du
 * trousseau est fixe pour l'installation, et l'IV l'est tout autant côté
 * OSCrypt de Chromium (16 espaces). Deux appels avec le même texte clair
 * produisent donc EXACTEMENT le même octet-à-octet chiffré — mesuré par la
 * campagne 4 (poste C) : révoquer puis ré-enregistrer le même mot de passe
 * redonne un `token` identique au caractère près.
 *
 * CONSÉQUENCE. Sans ce préfixe, comparer deux `better-vault.json` — entre deux
 * machines, ou le même fichier à deux instants — révèle si le mot de passe
 * maître est identique, sans jamais le connaître. Ce n'est pas une fuite du
 * mot de passe lui-même, mais une fuite d'ÉGALITÉ, qui n'a pas lieu d'être.
 *
 * Le sel n'est PAS stocké à part : il voyage à l'intérieur du texte chiffré
 * lui-même, en préfixe du texte clair confié à `safeStorage`. Rien à lire ni
 * à écrire ailleurs, rien à faire migrer sur les jetons déjà enregistrés — un
 * jeton pré-existant sans sel se décode simplement avec ses seize premiers
 * caractères ignorés au lieu d'un sel véritable, sans que cela ne fausse rien
 * : `decrypt()` les retranche dans tous les cas, sans les interpréter.
 */
export function encrypt (plaintext: string): Buffer {
    const salted = randomSalt() + plaintext
    return withSafeStorage('store', s => s.encryptString(salted))
}

export function decrypt (blob: Buffer): string {
    const salted = withSafeStorage('read', s => s.decryptString(blob))
    return salted.slice(SALT_LENGTH)
}
