import * as fs from 'fs'
import * as path from 'path'

import { configDir } from './tabbyConfig'
import { GUARD, Message, OPERATION, OperationId, REASON, briefError, english, isOperationId } from './messages'

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

/**
 * Au-delà de cet âge, un témoin est traité comme définitivement gelé même si le
 * processus qui l'a posé est encore vivant : ce n'est alors plus une invite en
 * cours mais un utilisateur absent, ou une fenêtre gelée pour une autre raison.
 * La campagne du 2026-07-29 a mesuré un blocage indéfini, sans réponse, encore
 * bloqué à 45 s ; ce seuil ajoute une marge plutôt que de coller à la mesure.
 */
const STUCK_AGE_MS = 60_000

/**
 * Le processus qui a posé ce témoin est-il toujours vivant ?
 *
 * `process.kill(pid, 0)` n'envoie aucun signal, il sonde seulement l'existence
 * du processus — sur Windows comme ailleurs. `EPERM` signifie qu'il existe mais
 * que nous n'avons pas le droit de lui envoyer un signal (processus élevé) : il
 * reste vivant. `ESRCH`, ou tout autre échec, signifie qu'il n'existe plus.
 */
function processAlive (pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false
    }
    try {
        process.kill(pid, 0)
        return true
    } catch (e: any) {
        return e?.code === 'EPERM'
    }
}

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
    // contenu n'est qu'un confort de diagnostic. On ne le rejette donc pas —
    // mais faute de `pid` exploitable, on ne peut pas non plus lui appliquer le
    // discriminant ci-dessous : il est relu comme définitivement suspendu.
    try {
        const parsed = JSON.parse(raw)
        const operation = isOperationId(parsed.operation) ? parsed.operation : undefined
        // Un témoin écrit par une version antérieure porte une phrase française
        // sous la clé `label` : elle est ignorée, et l'état est relu comme
        // anonyme. Afficher une étiquette non traduisible au milieu d'une
        // interface traduite serait pire que ne rien nommer.
        const since = typeof parsed.since === 'number' ? parsed.since : undefined
        const pid = typeof parsed.pid === 'number' ? parsed.pid : undefined

        // DISCRIMINANT entre « un appel est en vol en ce moment » et « un appel
        // n'est jamais revenu » — le garde-fou confondait les deux jusqu'ici, sur
        // la seule présence du fichier. Un témoin dont le processus qui l'a posé
        // est encore vivant ET récent décrit un appel PLAUSIBLEMENT en cours
        // ailleurs — typiquement une autre fenêtre Tabby démarrée au même
        // instant — pas un appel définitivement gelé. Le confondre refusait à
        // tort le trousseau à une troisième ou quatrième fenêtre pendant que les
        // précédentes se déverrouillaient normalement dans la même seconde (D4,
        // mesuré : trois fenêtres réussissent, une quatrième se voit refuser le
        // trousseau en prétendant qu'une opération démarrée dans la même seconde
        // n'est jamais revenue).
        //
        // Un processus mort qui a laissé son témoin, en revanche, n'est pas
        // ambigu : il ne reviendra plus jamais — c'est exactement le cas que ce
        // garde-fou existe pour couvrir (témoin survivant à un SIGKILL, mesuré).
        // Le pid ait pu depuis être réutilisé par un autre processus n'y change
        // rien : la seule question posée ici est « ce témoin décrit-il encore
        // quelqu'un en train d'agir », et un pid mort y répond non sans appel.
        //
        // Résiduel, assumé : un pid vivant réutilisé par un processus SANS
        // rapport, dans la fenêtre `STUCK_AGE_MS` qui suit la mort du vrai
        // titulaire, ferait lire à tort « en vol ». Fenêtre courte, coïncidence
        // requise sur le pid ET le moment — hors périmètre de ce correctif, qui
        // vise la confusion mesurée et non une garantie absolue.
        if (pid !== undefined && since !== undefined && Date.now() - since < STUCK_AGE_MS && processAlive(pid)) {
            return { suspended: false, operation, since }
        }

        return { suspended: true, operation, since }
    } catch {
        return { suspended: true }
    }
}

/**
 * Message prêt à journaliser (en anglais) ou à afficher (traduit).
 *
 * Quatre variantes entières plutôt qu'une phrase assemblée : voir `GUARD` dans
 * `messages.ts` pour la raison.
 *
 * LA DATE N'EST PAS RENDUE ICI. Elle l'était, avec la locale du système : le
 * même instant partait donc au journal — figé en anglais — dans un format qui
 * dépendait des réglages de la machine, et à l'écran sans égard pour la langue
 * de Tabby. Elle voyage désormais en millisecondes et chaque sortie la rend à
 * sa façon (`dateParams`).
 */
export function describeState (state: GuardState): Message {
    const operation = state.operation ? OPERATION[state.operation] : null
    const since = state.since ?? null

    if (operation && since) {
        return { source: GUARD.operationDated, dateParams: { date: since }, sourceParams: { operation } }
    }
    if (operation) {
        return { source: GUARD.operation, sourceParams: { operation } }
    }
    if (since) {
        return { source: GUARD.anonymousDated, dateParams: { date: since } }
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
 * Efface le témoin, mais seulement s'il porte encore NOTRE `pid` et NOTRE
 * `since` — pas sur sa seule présence.
 *
 * Mesuré par la campagne 5 (2026-08-06, VM Linux, deux vrais processus) : un
 * appel concurrent, dans un AUTRE processus, peut avoir écrit son propre témoin
 * PENDANT que le nôtre était gelé — `runGuarded()` l'autorise à le faire dès que
 * `guardState()` nous voit vivants et récents, exactement ce que le correctif du
 * discriminant vise. Effacer inconditionnellement dans le `finally`, comme avant
 * cette fonction, supprimait alors SA protection à lui, pas la nôtre : s'il
 * mourait à cet instant précis, plus aucun témoin ne survivait pour protéger le
 * démarrage suivant — ce que ce fichier existe justement pour empêcher.
 *
 * Résiduel, assumé : une fenêtre TOCTOU subsiste entre la lecture ci-dessous et
 * l'`unlink` de `clearWitness()` — un témoin qui appartient encore à quelqu'un
 * d'autre pourrait être remplacé par le nôtre pile dans cet intervalle. Fenêtre
 * de l'ordre de la microseconde, sans acteur malveillant à modéliser ici (même
 * utilisateur, même machine) : hors périmètre de ce correctif, qui vise la
 * suppression inconditionnelle mesurée, pas une garantie atomique complète.
 */
function clearOwnWitness (since: number): void {
    let raw: string
    try {
        raw = fs.readFileSync(witnessPath(), 'utf8')
    } catch {
        return // Déjà absent.
    }
    try {
        const parsed = JSON.parse(raw)
        if (parsed.pid !== process.pid || parsed.since !== since) {
            // Ce n'est plus le nôtre : un autre appel l'a reposé entre-temps.
            return
        }
    } catch {
        // Illisible : impossible de prouver qu'il est à nous, on ne le touche pas.
        return
    }
    clearWitness()
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

    const since = Date.now()
    try {
        fs.writeFileSync(
            witnessPath(),
            JSON.stringify({ operation, since, pid: process.pid }),
            { mode: 0o600 },
        )
    } catch (e) {
        throw suspendedError({ source: REASON.guardNotArmable, params: { error: briefError(e) } })
    }

    depth++
    try {
        return fn()
    } finally {
        // Jamais atteint si `fn` gèle : c'est exactement l'effet recherché, le
        // témoin survit au processus et protège le démarrage suivant.
        depth--
        // Pas `clearWitness()` sans condition : voir `clearOwnWitness()`, un
        // autre processus peut avoir reposé le sien entre-temps.
        clearOwnWitness(since)
    }
}
