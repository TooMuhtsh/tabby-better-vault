import * as fs from 'fs'
import * as path from 'path'

import { configDir } from './tabbyConfig'
import { GUARD, Message, OPERATION, OperationId, REASON, english, isOperationId } from './messages'

/**
 * Garde-fou contre le gel du démarrage par un appel bloquant au trousseau.
 *
 * LE PROBLÈME, MESURÉ. Sur un trousseau Linux présent mais VERROUILLÉ, tout
 * appel à `safeStorage` bloque le renderer tant que personne ne répond :
 * `isEncryptionAvailable()`, `encryptString()` et `decryptString()` — les trois,
 * mesurés 6/6 bloqués à 45 s en l'absence de réponse (campagnes des 2026-07-29,
 * .AIRules/ROADMAP.html#campagne-linux), avec contrôle décisif : plugin retiré,
 * trousseau toujours verrouillé, Tabby atteint sa pop-up normalement.
 *
 * CE QUI BLOQUE EXACTEMENT — et une première version de ce commentaire s'est
 * trompée sur les deux termes. Elle affirmait que l'appel « ne revient jamais,
 * sans afficher de dialogue ». Réfuté par mesure : le système AFFICHE une invite
 * d'authentification, et l'appel REND LA MAIN en 4 à 7 secondes dès qu'on y
 * répond. Ce n'est pas un gel irrécupérable, c'est une invite bloquante. Le
 * garde-fou reste nécessaire — un utilisateur absent bloque indéfiniment — mais
 * la nuance change ce qu'on doit dire à l'utilisateur, et elle rend praticable
 * la vérification réelle de `keychainRoundTrip()`.
 *
 * `getSelectedStorageBackend()`, lui, ne touche jamais le trousseau : mesuré à
 * 0,00 s, sans trafic D-Bus, verrou inchangé. C'est ce qui rend le raccourci
 * Linux d'`osKeychain.ts` légitime — et c'est aussi ce qui rendait creuse la
 * vérification du panneau de réglages avant `keychainRoundTrip()`.
 *
 * POURQUOI UN TÉMOIN SUR DISQUE, ET PAS UN DÉLAI D'ATTENTE. `@electron/remote`
 * fait de l'IPC SYNCHRONE : le fil du renderer est arrêté dans l'appel, plus
 * aucun code JavaScript ne s'exécute. On ne peut pas expirer, depuis le fil que
 * l'on bloque, un appel qui bloque ce fil. Un `try/catch` n'y change rien non
 * plus — un appel bloquant n'est pas une exception. Le seul recours qui survive
 * au gel est donc une trace laissée AVANT l'appel, relue au démarrage suivant.
 *
 * CE QUE ÇA GARANTIT, ET CE QUE ÇA NE GARANTIT PAS. Le premier blocage n'est
 * pas évité : il faut toucher le trousseau avant de savoir s'il répond. Ce qui
 * est garanti, c'est qu'il est le dernier tant que l'utilisateur ne demande pas
 * lui-même une nouvelle tentative — il ferme Tabby, et au démarrage suivant le
 * témoin subsiste, le plugin s'efface et Tabby retrouve sa pop-up native. Le
 * README dit exactement ceci.
 *
 * L'EXCEPTION EST DÉLIBÉRÉE, et elle a failli être un défaut. `keychainRoundTrip()`,
 * déclenchée depuis les réglages, peut poser un nouveau témoin et donc bloquer à
 * nouveau. C'est le prix d'une vérification qui vérifie. Ce qui était fautif,
 * c'est de lever le témoin SANS rien vérifier : le plugin repartait alors vers
 * un gel certain en ayant annoncé que tout allait bien (défaut D1).
 *
 * POURQUOI LE POINT DE PASSAGE EST `getSafeStorage()` ET PAS LES APPELANTS.
 * Au moment d'écrire ce dispositif, seul `isEncryptionAvailable()` avait été
 * mesuré bloquant ; que `encryptString`/`decryptString` le soient aussi (même
 * acquisition de clé OSCrypt) n'était qu'un raisonnement. Envelopper le point de
 * passage unique rendait le dispositif correct dans les deux cas — sans quoi il
 * aurait fallu parier. La deuxième campagne a tranché : les trois bloquent, le
 * pari aurait été perdu deux fois sur trois. Le point de passage reste unique
 * pour la même raison qu'avant : un futur appelant ne doit pas pouvoir passer à
 * côté.
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
    /**
     * Opération qui a gelé. Identifiant et non phrase : ce champ est écrit sur
     * disque et relu au démarrage suivant, éventuellement sous une autre locale
     * — voir `OperationId` dans `messages.ts`.
     */
    operation?: OperationId
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

/**
 * Erreur de refus du garde-fou.
 *
 * Elle transporte son `Message` non rendu en plus du texte anglais : l'appelant
 * qui l'affiche doit pouvoir le traduire, celui qui la journalise doit obtenir
 * de l'anglais. Le `message` de l'`Error` reste l'anglais, seul utile dans une
 * trace de pile.
 */
export function suspendedError (detail: Message): Error {
    const e = new Error(english(detail))
    ;(e as any)[SUSPENDED] = detail
    return e
}

export function isSuspendedError (e: any): boolean {
    return !!e?.[SUSPENDED]
}

/** Message traduisible porté par une erreur de refus, ou `null`. */
export function suspendedMessage (e: any): Message | null {
    return e?.[SUSPENDED] ?? null
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
            // Un témoin écrit par une version antérieure porte une phrase
            // française sous la clé `label` : elle est ignorée, et l'état est
            // relu comme anonyme. Afficher une étiquette non traduisible au
            // milieu d'une interface traduite serait pire que ne rien nommer.
            operation: isOperationId(parsed.operation) ? parsed.operation : undefined,
            since: typeof parsed.since === 'number' ? parsed.since : undefined,
        }
    } catch {
        return { suspended: true }
    }
}

/**
 * Message prêt à journaliser (en anglais) ou à afficher (traduit).
 *
 * Quatre variantes entières plutôt qu'une phrase assemblée : voir `GUARD` dans
 * `messages.ts` pour la raison. La date est rendue ici, avec la locale du
 * système — c'est un paramètre, pas une clé.
 */
export function describeState (state: GuardState): Message {
    const operation = state.operation ? OPERATION[state.operation] : null
    const date = state.since ? new Date(state.since).toLocaleString() : null

    if (operation && date) {
        return { source: GUARD.operationDated, params: { date }, sourceParams: { operation } }
    }
    if (operation) {
        return { source: GUARD.operation, sourceParams: { operation } }
    }
    if (date) {
        return { source: GUARD.anonymousDated, params: { date } }
    }
    return { source: GUARD.anonymous }
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
export function runGuarded<T> (operation: OperationId, fn: () => T): T {
    if (depth > 0) {
        return fn()
    }

    const state = guardState()
    if (state.suspended) {
        throw suspendedError(describeState(state))
    }

    try {
        fs.writeFileSync(
            witnessPath(),
            JSON.stringify({ operation, since: Date.now(), pid: process.pid }),
            { mode: 0o600 },
        )
    } catch (e) {
        throw suspendedError({ source: REASON.guardNotArmable, params: { error: String(e) } })
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
