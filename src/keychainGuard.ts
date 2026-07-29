import * as fs from 'fs'
import * as path from 'path'

import { configDir } from './tabbyConfig'

/**
 * Garde-fou contre le gel du démarrage par un appel bloquant au trousseau.
 *
 * LE PROBLÈME, MESURÉ. Sur un trousseau Linux présent mais VERROUILLÉ,
 * `safeStorage.isEncryptionAvailable()` NE REVIENT JAMAIS : il déclenche une
 * demande de déverrouillage qui n'aboutit pas, sans afficher de dialogue.
 * Constaté par une campagne de vérification indépendante le 2026-07-29
 * (.AIRules/ROADMAP.html#campagne-linux), banc Electron 38.8.6, avec contrôle
 * décisif — plugin retiré, trousseau toujours verrouillé, Tabby atteint sa
 * pop-up normalement.
 *
 * POURQUOI UN TÉMOIN SUR DISQUE, ET PAS UN DÉLAI D'ATTENTE. `@electron/remote`
 * fait de l'IPC SYNCHRONE : le fil du renderer est arrêté dans l'appel, plus
 * aucun code JavaScript ne s'exécute. On ne peut pas expirer, depuis le fil que
 * l'on bloque, un appel qui bloque ce fil. Un `try/catch` n'y change rien non
 * plus — un appel bloquant n'est pas une exception. Le seul recours qui survive
 * au gel est donc une trace laissée AVANT l'appel, relue au démarrage suivant.
 *
 * CE QUE ÇA GARANTIT, ET CE QUE ÇA NE GARANTIT PAS. Le premier gel n'est pas
 * évité : il faut toucher le trousseau avant de savoir s'il répond. Ce qui est
 * garanti, c'est qu'il est le dernier — l'utilisateur force la fermeture de
 * Tabby, et au démarrage suivant le témoin subsiste, le plugin s'efface et
 * Tabby retrouve sa pop-up native. Le README dit exactement ceci.
 *
 * POURQUOI LE POINT DE PASSAGE EST `getSafeStorage()` ET PAS LES APPELANTS.
 * `isEncryptionAvailable()` est le seul appel dont on ait MESURÉ le blocage,
 * mais `encryptString`/`decryptString` passent par la même acquisition de clé
 * OSCrypt et bloquent très probablement de la même manière — c'est un
 * raisonnement, pas une mesure, et ce projet a déjà vu trois déductions de ce
 * genre réfutées en une journée. Envelopper le point de passage unique rend le
 * dispositif correct dans les deux cas, et interdit qu'un futur appelant passe
 * à côté.
 *
 * Ce fichier est strictement local à la machine, comme better-vault.json : il
 * décrit l'état d'un trousseau, qui n'a aucun sens ailleurs.
 */

const FILENAME = 'better-vault-keychain.lock'

/** Marqueur porté par les erreurs de refus, pour les distinguer des vraies pannes. */
const SUSPENDED = 'betterVaultKeychainSuspended'

export interface GuardState {
    /** Une sonde précédente n'est jamais revenue : le trousseau est consigné. */
    suspended: boolean
    /** Opération qui a gelé, telle qu'elle avait été étiquetée. */
    label?: string
    /** Date de l'appel gelé (ms depuis l'époque). */
    since?: number
}

function witnessPath (): string {
    return path.join(configDir(), FILENAME)
}

/**
 * Profondeur d'imbrication dans le processus courant.
 *
 * Sans ce compteur, un appel gardé imbriqué dans un autre lirait le témoin que
 * nous venons nous-mêmes de poser et se refuserait tout seul. Aucun appelant ne
 * s'imbrique aujourd'hui, mais l'erreur serait déroutante et le garde-fou n'est
 * utile que s'il ne se déclenche jamais à tort.
 */
let depth = 0

export function suspendedError (detail: string): Error {
    const e = new Error(detail)
    ;(e as any)[SUSPENDED] = true
    return e
}

export function isSuspendedError (e: any): boolean {
    return !!e?.[SUSPENDED]
}

export function guardState (): GuardState {
    let raw: string
    try {
        raw = fs.readFileSync(witnessPath(), 'utf8')
    } catch {
        return { suspended: false }
    }
    // Témoin illisible ou tronqué : sa seule PRÉSENCE porte l'information, le
    // contenu n'est qu'un confort de diagnostic. On ne le rejette donc pas.
    try {
        const parsed = JSON.parse(raw)
        return {
            suspended: true,
            label: typeof parsed.label === 'string' ? parsed.label : undefined,
            since: typeof parsed.since === 'number' ? parsed.since : undefined,
        }
    } catch {
        return { suspended: true }
    }
}

/** Phrase prête à journaliser ou à afficher, au format « le … a gelé le … ». */
export function describeState (state: GuardState): string {
    const what = state.label ? `l'opération « ${state.label} »` : 'un accès au trousseau'
    const when = state.since ? ` le ${new Date(state.since).toLocaleString()}` : ''
    return `${what} n'est jamais revenue${when} — le trousseau est probablement verrouillé`
}

function clearWitness (): void {
    try {
        fs.unlinkSync(witnessPath())
    } catch {
        // Déjà absent : rien à faire.
    }
}

/**
 * Lève la consignation à la demande explicite de l'utilisateur.
 *
 * Réservé au panneau de réglages : un ré-armement automatique ramènerait le gel
 * à chaque démarrage, ce qui est précisément ce que ce fichier existe pour
 * empêcher.
 */
export function rearm (): void {
    clearWitness()
}

/**
 * Exécute `fn` sous protection. Lève une erreur marquée `suspendedError` — sans
 * jamais appeler `fn` — si une sonde précédente n'est pas revenue.
 *
 * Si le témoin ne peut pas être écrit, l'appel est REFUSÉ plutôt que tenté sans
 * filet : un trousseau qui ne se déverrouille pas tout seul est une gêne, un
 * Tabby qui ne démarre plus est une panne. Le dossier étant celui où vit
 * better-vault.json, le cas suppose de toute façon un plugin déjà hors d'état
 * d'enregistrer quoi que ce soit.
 */
export function runGuarded<T> (label: string, fn: () => T): T {
    if (depth > 0) {
        return fn()
    }

    const state = guardState()
    if (state.suspended) {
        throw suspendedError(`accès au trousseau suspendu — ${describeState(state)}`)
    }

    try {
        fs.writeFileSync(
            witnessPath(),
            JSON.stringify({ label, since: Date.now(), pid: process.pid }),
            { mode: 0o600 },
        )
    } catch (e) {
        throw suspendedError(`garde-fou du trousseau non armable (${String(e)}) — accès refusé par précaution`)
    }

    depth++
    try {
        return fn()
    } finally {
        // Jamais atteint si `fn` gèle : c'est exactement l'effet recherché, le
        // témoin survit au processus et protège le démarrage suivant.
        depth--
        clearWitness()
    }
}
