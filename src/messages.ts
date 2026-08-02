/**
 * Messages qui doivent survivre à deux usages incompatibles : le journal et
 * l'écran.
 *
 * POURQUOI CE FICHIER EXISTE. Ces phrases servaient les deux à la fois — le
 * motif d'indisponibilité du trousseau était affiché tel quel par le panneau de
 * réglages ET écrit dans `better-vault.log`. Les traduire aurait traduit la
 * ligne de journal avec elles, or ce fichier est persistant et relu après coup,
 * y compris par nous en support : une ligne dont la langue dépend de la locale
 * active à l'instant de l'écriture ne peut plus être ni cherchée ni comparée, et
 * un même fichier changerait de langue en cours de route si l'utilisateur change
 * de locale.
 *
 * D'où la séparation : un `Message` transporte sa chaîne source anglaise et ses
 * paramètres, sans être rendu. Le journal l'écrit en anglais via `english()`,
 * l'interface le traduit en passant la MÊME chaîne source à ngx-translate — qui
 * cherche justement ses traductions par la chaîne source (cf. `src/i18n/`). Une
 * seule table de vérité, deux rendus.
 *
 * CONTRAINTE SUR LES PARAMÈTRES : substitutions simples `{nom}` uniquement,
 * jamais les formes plurielles ni les sélecteurs d'ICU MessageFormat.
 * `english()` ne sait faire que cela — un pluriel ICU y sortirait littéralement,
 * alors qu'il serait correctement rendu côté interface. Le journal et l'écran
 * cesseraient de dire la même chose.
 */

export interface Message {
    /** Chaîne source anglaise : texte du journal ET clé de traduction. */
    source: string
    /** Substitutions littérales — messages d'erreur système, noms techniques. */
    params?: Record<string, string>
    /**
     * Substitutions qui sont elles-mêmes des chaînes sources à traduire.
     *
     * Distinguées des précédentes parce qu'un paramètre inséré tel quel dans une
     * phrase traduite y laisserait un mot anglais : « l'opération “keychain
     * diagnosis” n'est jamais revenue ». Le journal les traite comme les autres,
     * l'interface les traduit d'abord.
     */
    sourceParams?: Record<string, string>
    /**
     * Substitutions qui sont des INSTANTS, non des textes — millisecondes depuis
     * l'époque.
     *
     * Troisième catégorie pour la même raison que la deuxième : une date rendue
     * une seule fois ne peut pas servir les deux sorties. Rendue ici, elle
     * partait au journal dans la locale du SYSTÈME — soit ni la langue du
     * journal, qui est figé en anglais, ni celle de l'interface, qui suit Tabby.
     * Un `better-vault.log` en anglais pouvait donc porter des dates au format
     * français, et le panneau les afficher dans une troisième forme encore.
     *
     * Le journal les rend par `logDate()` (format fixe), l'interface par la
     * locale de Tabby. Voir `I18nService.date()`.
     */
    dateParams?: Record<string, number>
}

/** Longueur au-delà de laquelle un motif technique cesse d'informer. */
const MAX_ERROR_LENGTH = 160

/**
 * Condense une erreur en une ligne.
 *
 * `String(e)` était inséré tel quel dans les motifs ci-dessous. Une erreur qui
 * traverse `@electron/remote` embarque la pile de l'AUTRE processus dans son
 * propre message : neuf lignes, dont sept de pile Node, mesurées à l'écran ET au
 * journal par la campagne du 2026-08-01 — pour un utilisateur qui venait
 * simplement de refuser une invite d'authentification. Au journal, c'est en
 * outre une entrée étalée sur neuf lignes dans un fichier dont la rétention
 * raisonne par ligne.
 *
 * La pile est perdue, délibérément : elle décrit le processus principal
 * d'Electron et non le chemin de code du plugin, elle n'aide donc pas à situer
 * un défaut d'ici. Le motif, lui, est conservé.
 */
export function briefError (e: unknown): string {
    const raw = e instanceof Error && e.message ? e.message : String(e)
    const first = raw
        .split('\n')
        .map(line => line.trim())
        .find(line => line && !/^at\s/.test(line))
    const brief = (first ?? raw.trim()).replace(/\s+/g, ' ')
    return brief.length > MAX_ERROR_LENGTH ? brief.slice(0, MAX_ERROR_LENGTH - 1) + '…' : brief
}

/**
 * Date pour le JOURNAL : format fixe, jamais localisé.
 *
 * Même raison que pour les phrases — un fichier persistant et relu après coup ne
 * peut pas changer de format au gré de la locale active à l'instant de
 * l'écriture. C'est le format des horodatages de `logger.ts`, qui l'emprunte à
 * cette fonction : une ligne et les dates qu'elle cite s'écrivent pareil.
 */
export function logDate (at: number | Date = new Date()): string {
    const d = at instanceof Date ? at : new Date(at)
    const p = (n: number): string => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Motifs d'indisponibilité du trousseau.
 *
 * NE JAMAIS RETOUCHER UNE DE CES CHAÎNES SANS METTRE À JOUR `src/i18n/` : c'est
 * la clé de traduction elle-même. Une correction de typographie suffit à faire
 * retomber la locale sur l'anglais, silencieusement et sans erreur.
 */
export const REASON = {
    backendBasicText: 'Linux keychain unavailable (basic_text backend: hard-coded key, encryption is not trustworthy)',
    noEncryption: 'the system offers no encryption (isEncryptionAvailable=false)',
    roundTripMismatch: 'the keychain responded, but the encryption round trip does not return the original value',
    safeStorageUnusable: 'safeStorage is unusable — {error}',
    roundTripFailed: 'the keychain did not honour the round trip — {error}',
    guardNotArmable: 'the keychain guard cannot be armed ({error}) — access refused as a precaution',
}

/**
 * Étiquette de l'opération en cours, telle qu'elle est inscrite dans le témoin
 * du garde-fou.
 *
 * IDENTIFIANTS ET NON PHRASES, et la distinction n'est pas cosmétique : le
 * témoin est écrit sur disque AVANT l'appel qui gèle, puis relu au démarrage
 * SUIVANT. Y stocker du texte traduit ferait relire en anglais un témoin écrit
 * en français — le seul indice dont dispose l'utilisateur pour savoir où le
 * trousseau a cessé de répondre, rendu incohérent par un changement de langue.
 */
export type OperationId = 'diagnose' | 'verify' | 'store' | 'read'

export const OPERATION: Record<OperationId, string> = {
    diagnose: 'keychain diagnosis',
    verify: 'keychain verification',
    store: 'saving the password',
    read: 'reading the password back',
}

export function isOperationId (value: any): value is OperationId {
    return typeof value === 'string' && value in OPERATION
}

/**
 * Phrases du garde-fou, en variantes entières plutôt qu'en concaténation.
 *
 * Assembler « l'opération X » + « n'est jamais revenue » + « le … » donnerait
 * trois fragments intraduisibles : l'ordre des mots et les accords ne se
 * transposent pas d'une langue à l'autre. Chaque variante est donc une phrase
 * complète, avec ses paramètres.
 *
 * Les variantes sans opération couvrent deux cas réels : un témoin illisible ou
 * tronqué, dont seule la présence porte l'information, et un témoin écrit par
 * une version antérieure du plugin — qui y inscrivait une phrase française là
 * où vit désormais un identifiant. Un tel témoin est relu comme anonyme plutôt
 * que d'afficher une étiquette non traduisible.
 */
export const GUARD = {
    operationDated: 'the operation “{operation}” never returned on {date} — the keychain is probably locked',
    operation: 'the operation “{operation}” never returned — the keychain is probably locked',
    anonymousDated: 'a keychain access never returned on {date} — the keychain is probably locked',
    anonymous: 'a keychain access never returned — the keychain is probably locked',
}

/**
 * Rend un message en anglais, pour le journal.
 *
 * Volontairement minimal. Un paramètre absent laisse son marqueur en place
 * plutôt que d'écrire « undefined » : une ligne de journal amputée reste
 * lisible, une ligne qui affirme une valeur qu'elle n'a pas ne l'est pas.
 */
export function english (message: Message): string {
    const dates: Record<string, string> = {}
    for (const [key, at] of Object.entries(message.dateParams ?? {})) {
        dates[key] = logDate(at)
    }
    const all = { ...message.sourceParams, ...dates, ...message.params }
    if (!Object.keys(all).length) {
        return message.source
    }
    return message.source.replace(/\{(\w+)\}/g, (whole, key) => all[key] ?? whole)
}
