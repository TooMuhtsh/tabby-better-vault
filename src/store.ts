import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { configDir } from './tabbyConfig'

/**
 * État du plugin : réglages ET jeton chiffré, dans un fichier à part.
 *
 * DEUX raisons indépendantes de ne rien mettre dans config.yaml, et chacune
 * suffirait :
 *
 *   1. IMPOSSIBILITÉ TECHNIQUE (piège #V11). Quand l'utilisateur active le
 *      chiffrement de configuration, config.yaml ne contient plus que `vault`,
 *      `encrypted` et `configSync` : tout le reste, y compris les réglages de ce
 *      plugin, est à l'intérieur du blob chiffré. Or c'est précisément là que le
 *      plugin doit agir — avant que la config ne soit déchiffrable. Lire nos
 *      réglages depuis config.yaml exigerait le mot de passe qu'on cherche
 *      justement à fournir.
 *
 *   2. SYNCHRONISATION. La sync de config de Tabby envoie tout config.yaml sauf
 *      la clé `configSync`, et écrase le fichier local par la version distante.
 *      Un jeton propre à une machine y déclencherait une boucle de destruction
 *      mutuelle entre machines.
 *
 * Corollaire heureux de (2) : ce fichier étant strictement local, chaque machine
 * a naturellement ses propres réglages — un poste fixe peut garder le mot de
 * passe une semaine pendant qu'un portable le redemande chaque jour, sans aucune
 * mécanique de synchronisation à écrire.
 */

const FILENAME = 'better-vault.json'
/** Ancien emplacement du jeton seul, antérieur au 2026-07-28. */
const LEGACY_TOKEN_FILENAME = 'better-vault-token.bin'

export type ExpiryMode = 'schedule' | 'sliding' | 'never'

export interface Expiry {
    mode: ExpiryMode
    /** Mode `schedule` : jour de la semaine, 0 = dimanche, 1 = lundi. */
    weekday: number
    /** Mode `schedule` : heure locale, 0-23. */
    hour: number
    /** Mode `sliding` : durée de validité en jours. */
    days: number
}

export interface Settings {
    /** Opt-in strict : rien ne se produit tant que ce n'est pas true. */
    enabled: boolean
    /** Observation seule : journalise sans jamais servir ni capturer. */
    debug: boolean
    /** Libellé de cette machine, pour s'y retrouver dans les réglages et le journal. */
    machineName: string
    /** Durée de conservation du journal, en jours. 0 = illimitée. */
    logRetentionDays: number
    expiry: Expiry
    /** Mot de passe maître chiffré par l'OS, encodé en base64. */
    token: string | null
    /** Échéance du jeton courant (ms depuis l'époque), null si sans expiration. */
    tokenExpiresAt: number | null
}

/** Lundi 3 h du matin : la ressaisie tombe en début de semaine, pas en pleine session. */
export const DEFAULT_EXPIRY: Expiry = { mode: 'schedule', weekday: 1, hour: 3, days: 7 }

function defaults (): Settings {
    return {
        enabled: false,
        debug: false,
        machineName: os.hostname(),
        // 90 jours : assez pour enquêter sur un incident passé, pas assez pour
        // que le fichier devienne illisible.
        logRetentionDays: 90,
        expiry: { ...DEFAULT_EXPIRY },
        token: null,
        tokenExpiresAt: null,
    }
}

function storePath (): string {
    return path.join(configDir(), FILENAME)
}

function coerceNumber (value: any, fallback: number, min: number, max: number): number {
    const n = Number(value)
    return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback
}

export function readSettings (): Settings {
    const base = defaults()
    let parsed: any
    try {
        parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'))
    } catch {
        // Fichier absent ou illisible : le plugin reste inactif.
        return base
    }
    const expiry = parsed.expiry ?? {}
    return {
        enabled: parsed.enabled === true,
        debug: parsed.debug === true,
        machineName: typeof parsed.machineName === 'string' && parsed.machineName ? parsed.machineName : base.machineName,
        logRetentionDays: coerceNumber(parsed.logRetentionDays, base.logRetentionDays, 0, 3650),
        expiry: {
            mode: ['schedule', 'sliding', 'never'].includes(expiry.mode) ? expiry.mode : base.expiry.mode,
            weekday: coerceNumber(expiry.weekday, base.expiry.weekday, 0, 6),
            hour: coerceNumber(expiry.hour, base.expiry.hour, 0, 23),
            days: coerceNumber(expiry.days, base.expiry.days, 1, 365),
        },
        token: typeof parsed.token === 'string' ? parsed.token : null,
        tokenExpiresAt: typeof parsed.tokenExpiresAt === 'number' ? parsed.tokenExpiresAt : null,
    }
}

/**
 * Journalise depuis ce module par `require` tardif et non par `import` :
 * `logger.ts` importe déjà ce fichier, un import en tête créerait un cycle à
 * l'initialisation des modules. Ces chemins-ci s'exécutent bien après, et
 * restent enveloppés — la résolution du cycle dépend de l'empaqueteur.
 */
function journal (level: 'warn' | 'crit', message: string): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./logger')[level](message)
    } catch {
        // Journal indisponible : on ne fait pas échouer l'appelant davantage
        // pour une trace.
    }
}

/**
 * Dernier recours : écriture directe sur la cible, non atomique.
 *
 * Abandonner ici PERDRAIT l'écriture, donc le jeton que l'utilisateur vient de
 * confier — pire que le comportement d'avant que le motif atomique n'existe. On
 * rétablit l'ancien compromis plutôt que rien. Le cas visé est Windows, où
 * `rename` sur une cible existante échoue en EPERM ou EBUSY dès qu'un antivirus
 * ou un client de synchronisation tient le fichier ouvert.
 *
 * L'ÉCRITURE D'ABORD, LE JOURNAL ENSUITE : journaliser en premier ferait
 * dépendre le sauvetage du jeton de la réussite d'une trace.
 */
function writeDirectly (target: string, tmp: string, payload: string, cause: unknown): void {
    try {
        // Si la CIBLE est elle-même un lien, ce chemin écrit à travers. Assumé :
        // c'est un recours, et refuser ici perdrait le jeton. Le lien symbolique
        // qui a été mesuré est celui du temporaire, dont le nom est prévisible ;
        // celui de la cible suppose déjà un dossier de config compromis.
        fs.writeFileSync(target, payload, { mode: 0o600 })
        try {
            fs.chmodSync(target, 0o600)
        } catch {
            // Système de fichiers sans permissions POSIX : rien à resserrer.
        }
    } catch (e) {
        // Rien n'a été écrit, par aucun des deux chemins. L'erreur remonte —
        // c'est ce qui empêche `learnFromUser()` d'annoncer un enregistrement
        // qui n'a pas eu lieu — mais elle laisse d'abord une trace, faute de quoi
        // la seule manifestation de l'échec serait une absence.
        journal('crit', `could not write ${FILENAME} (${String(e)}) — nothing was saved; the atomic path had failed with ${String(cause)}`)
        throw e
    }

    try {
        fs.unlinkSync(tmp)
    } catch {
        // Temporaire déjà parti, ou verrouillé : sans conséquence.
    }
    journal('warn', `atomic write failed (${String(cause)}) — fell back to a direct write`)
}

/**
 * Écrit les réglages : temporaire NEUF puis rename.
 *
 * TROIS PROPRIÉTÉS VOULUES, et ce que chacune vaut réellement.
 *
 *   1. LE FICHIER QUI ATTERRIT EST NEUF, DONC EN 0600. `writeFileSync(path,
 *      data, { mode })` n'applique le mode QU'À LA CRÉATION : sur un fichier
 *      préexistant en 644 ou 666, le mode est ignoré et jamais re-serré, si bien
 *      que « lisible par le seul propriétaire » tombait dès qu'un fichier
 *      préexistait plus large. Le temporaire est donc supprimé puis ouvert en
 *      `wx` (O_CREAT|O_EXCL), qui échoue si quoi que ce soit occupe déjà le
 *      chemin : la création est garantie, donc le mode s'applique, et aucun
 *      `chmod` postérieur n'est nécessaire.
 *
 *      C'est ce `chmod` postérieur qui portait le défaut suivant : le contenu
 *      était écrit AVANT le resserrage des droits, si bien que le temporaire
 *      existait en 0666 avec le jeton dedans — 82 250 observations à la mesure
 *      (campagne du 2026-08-01).
 *
 *   2. AUCUN LIEN SYMBOLIQUE N'EST SUIVI. Le nom du temporaire est fixe, donc
 *      prévisible, donc plantable : `writeFileSync` écrivait À TRAVERS un lien
 *      posé à sa place et `renameSync` déplaçait le lien lui-même — better-vault.json
 *      devenait un lien, le jeton atterrissait où le lien pointait, et le
 *      `chmod` suivait vers la victime. `wx` refuse un chemin existant, lien
 *      compris, et `unlink` retire le lien sans toucher sa cible.
 *
 *      Nom fixe malgré tout, et non aléatoire : un incident répété laisserait
 *      autrement une traînée de fichiers portant chacun un jeton chiffré.
 *
 *   3. L'ÉCRITURE EST ATOMIQUE FACE À UN LECTEUR CONCURRENT — et à lui seul.
 *      `rename` est atomique sur un même système de fichiers, d'où le temporaire
 *      dans le MÊME dossier que la cible (un rename entre volumes échoue en
 *      EXDEV). Face à une COUPURE il ne garantit rien : aucun `fsync` n'est émis,
 *      ni sur le temporaire ni sur le dossier, `strace` en compte zéro. Ne pas
 *      écrire ici que le fichier survit à une coupure — la mesure dit l'inverse.
 *
 * TOUT ÉCHEC EST JOURNALISÉ. Le `try` ne couvrait que `rename` : un dossier en
 * lecture seule faisait échapper l'EACCES de l'écriture du temporaire sans
 * laisser une seule ligne, et la cible restait telle quelle, avec son ancien
 * contenu et ses anciens droits.
 */
export function writeSettings (settings: Settings): void {
    const target = storePath()
    const tmp = target + '.tmp'
    const payload = JSON.stringify(settings, null, 2)

    try {
        // Un temporaire résiduel — écriture interrompue, ou lien posé là — ferait
        // échouer `wx`. On le retire d'abord ; sur un lien, `unlink` supprime le
        // lien et non ce qu'il désigne, ce qui est exactement voulu.
        try {
            fs.unlinkSync(tmp)
        } catch {
            // Absent : c'est le cas nominal.
        }
        // mode 0600 : lisible par le seul propriétaire (sans effet réel sur
        // Windows, où la protection vient de DPAPI lui-même).
        fs.writeFileSync(tmp, payload, { mode: 0o600, flag: 'wx' })
        fs.renameSync(tmp, target)
    } catch (e) {
        writeDirectly(target, tmp, payload, e)
    }
}

/**
 * Calcule l'échéance d'un jeton enregistré à l'instant `from`.
 *
 * En mode `schedule`, on vise le prochain créneau jour+heure STRICTEMENT
 * postérieur à `from` : un jeton créé un lundi à 2 h expire le jour même à 3 h,
 * pas une semaine plus tard. Tout est en heure locale, de sorte qu'un
 * changement d'heure décale l'échéance d'une heure sans autre conséquence.
 */
export function computeExpiry (expiry: Expiry, from: Date = new Date()): number | null {
    if (expiry.mode === 'never') {
        return null
    }
    if (expiry.mode === 'sliding') {
        // Le champ de saisie peut être temporairement vide pendant que
        // l'utilisateur tape : sans ce garde, `days` vaudrait null et
        // l'échéance deviendrait NaN, donc `null` une fois sérialisée.
        const days = Number.isFinite(expiry.days) && expiry.days >= 1 ? expiry.days : DEFAULT_EXPIRY.days
        return from.getTime() + days * 24 * 60 * 60 * 1000
    }
    const target = new Date(from.getFullYear(), from.getMonth(), from.getDate(), expiry.hour, 0, 0, 0)
    let delta = (expiry.weekday - from.getDay() + 7) % 7
    if (delta === 0 && target.getTime() <= from.getTime()) {
        delta = 7
    }
    target.setDate(target.getDate() + delta)
    return target.getTime()
}

export function readToken (): Buffer | null {
    const { token } = readSettings()
    return token ? Buffer.from(token, 'base64') : null
}

/** Le jeton enregistré a-t-il dépassé son échéance ? */
export function tokenHasExpired (settings: Settings = readSettings(), now: number = Date.now()): boolean {
    return settings.tokenExpiresAt !== null && now > settings.tokenExpiresAt
}

export function writeToken (blob: Buffer): number | null {
    const settings = readSettings()
    const tokenExpiresAt = computeExpiry(settings.expiry)
    writeSettings({ ...settings, token: blob.toString('base64'), tokenExpiresAt })
    return tokenExpiresAt
}

export function deleteToken (): void {
    const settings = readSettings()
    if (settings.token || settings.tokenExpiresAt !== null) {
        writeSettings({ ...settings, token: null, tokenExpiresAt: null })
    }
}

/** Supprime l'ancien fichier de jeton, devenu inutilisable. */
export function cleanUpLegacyToken (): void {
    try {
        fs.unlinkSync(path.join(configDir(), LEGACY_TOKEN_FILENAME))
    } catch {
        // Absent : rien à faire.
    }
}
