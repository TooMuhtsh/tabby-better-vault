import * as fs from 'fs'
import * as path from 'path'

import { logDate } from './messages'
import { configDir } from './tabbyConfig'
import { readSettings } from './store'

/**
 * Journal d'événements du plugin.
 *
 * Sert à deux usages qui n'ont pas les mêmes exigences : diagnostiquer un
 * démarrage, et savoir après coup quand le coffre a été ouvert. D'où
 * l'horodatage absolu de chaque ligne — un délai relatif au lancement répond au
 * premier besoin, jamais au second.
 *
 * CE FICHIER EST EN ANGLAIS, ET N'EST PAS TRADUIT. Décidé le 2026-08-01, en même
 * temps que l'internationalisation de l'interface. Le journal est persistant et
 * relu après coup : une ligne écrite dans la langue active à l'instant de
 * l'écriture rendrait le fichier incohérent dès que l'utilisateur change de
 * locale, et incherchable pour qui l'analyse — nous en support les premiers. Une
 * seule langue, stable, choisie pour être celle du plus grand nombre de lecteurs
 * possibles.
 *
 * Les messages qui doivent aussi s'AFFICHER passent par `messages.ts`, qui les
 * transporte sous forme de chaîne source + paramètres : anglais ici, traduits à
 * l'écran.
 *
 * INVARIANT : ce journal ne reçoit JAMAIS le mot de passe maître, ni aucune
 * valeur permettant de le reconstituer — sa longueur comprise. Seuls des
 * événements de cycle de vie y figurent.
 *
 * Ce fichier reste local à la machine et n'est ni versionné, ni synchronisé.
 * Il n'est pas non plus infalsifiable : c'est un texte modifiable par quiconque
 * accède à la session de l'utilisateur. Outil de diagnostic et de détection
 * après coup, pas élément de preuve.
 */

export type Level = 'INFO' | 'WARN' | 'CRIT'

/**
 * Garde-fou indépendant de la rétention par date : celle-ci ne s'applique qu'au
 * démarrage, et ne protégerait donc pas d'un incident qui journaliserait en
 * boucle pendant une session. Volontairement non configurable.
 */
const HARD_SIZE_LIMIT = 4 * 1024 * 1024

export const LOG_PATH = path.join(configDir(), 'better-vault.log')

/**
 * Emprunté à `messages.ts` plutôt que redéfini ici : une ligne de journal et
 * une date CITÉE dans cette ligne doivent s'écrire pareil, sans quoi le même
 * fichier porte deux formats.
 */
const stamp = logDate

function append (line: string): void {
    try {
        fs.appendFileSync(LOG_PATH, line + '\n', 'utf8')
    } catch {
        // Un journal indisponible ne doit jamais faire échouer le plugin.
    }
}

function writeLine (level: Level, message: string): void {
    const line = `[${stamp()}] ${level.padEnd(4)} ${message}`
    // eslint-disable-next-line no-console
    console.log('[better-vault]', line)
    append(line)
}

/**
 * Étouffe les répétitions immédiates d'une même ligne — constaté le 2026-08-03 :
 * sur une configuration chiffrée, Tabby appelle deux fois `getPassphrase()` par
 * sauvegarde de `config.yaml`, jusqu'à quatre fois par seconde en rafale, 262
 * déverrouillages journalisés en une journée (ROADMAP.html § Journal saturé).
 * Le pont ne boucle pas : c'est Tabby qui rappelle, et nous qui parlons à chaque
 * appel — le bruit est un symptôme que ce plugin rend visible, pas un défaut
 * qu'il crée.
 *
 * Mécanisme réutilisable — sur le modèle de `unlockAnnounced` de
 * `vaultBridge.service.ts`, mais porté ici pour profiter à toute ligne répétée,
 * pas seulement au déverrouillage — et non spécifique à un message : n'importe
 * quel appelant de `log`/`warn`/`crit` en bénéficie sans rien changer chez lui.
 *
 * La PREMIÈRE occurrence d'une rafale part en clair, immédiatement : elle porte
 * l'information « quand », l'une des deux raisons d'être de ce journal. Les
 * répétitions identiques qui suivent sont comptées, sans écrire une ligne
 * chacune, puis résumées en une seule après une accalmie — pas avant, pour ne
 * pas fragmenter un dénombrement en cours.
 */
const REPEAT_FLUSH_DELAY_MS = 3000

interface PendingRepeat {
    level: Level
    message: string
    count: number
    firstAt: number
    timer: ReturnType<typeof setTimeout>
}

let pending: PendingRepeat | null = null

function flushPending (): void {
    if (!pending) {
        return
    }
    const { level, message, count, firstAt } = pending
    pending = null
    if (count <= 0) {
        return
    }
    const seconds = Math.max(1, Math.round((Date.now() - firstAt) / 1000))
    writeLine(level, `${message} (repeated ${count} more time${count === 1 ? '' : 's'} over the following ${seconds}s)`)
}

function write (level: Level, message: string): void {
    if (pending && pending.level === level && pending.message === message) {
        pending.count++
        clearTimeout(pending.timer)
        pending.timer = setTimeout(flushPending, REPEAT_FLUSH_DELAY_MS)
        return
    }
    // Une ligne différente arrive : la rafale précédente, s'il y en avait une,
    // est résumée maintenant plutôt que d'attendre son propre délai.
    flushPending()
    writeLine(level, message)
    pending = { level, message, count: 0, firstAt: Date.now(), timer: setTimeout(flushPending, REPEAT_FLUSH_DELAY_MS) }
}

export function log (message: string): void {
    write('INFO', message)
}

export function warn (message: string): void {
    write('WARN', message)
}

/** Garde-fou déclenché : l'utilisateur doit pouvoir comprendre pourquoi. */
export function crit (message: string): void {
    write('CRIT', message)
}

/** `[2026-07-28 21:30:12]` en tête de ligne, ou null si la ligne n'en porte pas. */
function lineDate (line: string): Date | null {
    const m = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\]/.exec(line)
    if (!m) {
        return null
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
}

/**
 * Applique la politique de rétention, puis le plafond de taille.
 *
 * Les lignes sans horodatage reconnaissable sont conservées : mieux vaut garder
 * une ligne de trop qu'effacer un événement dont le format aurait changé.
 */
export function applyRetention (): void {
    let content: string
    try {
        content = fs.readFileSync(LOG_PATH, 'utf8')
    } catch {
        return // Pas encore de journal : rien à faire.
    }

    const days = readSettings().logRetentionDays
    let lines = content.split(/\r?\n/)
    let purged = 0

    if (days > 0) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
        const kept = lines.filter(line => {
            const d = lineDate(line)
            if (!d) {
                return true
            }
            const keep = d.getTime() >= cutoff
            if (!keep) {
                purged++
            }
            return keep
        })
        lines = kept
    }

    let truncated = false
    let out = lines.join('\n')
    if (Buffer.byteLength(out, 'utf8') > HARD_SIZE_LIMIT) {
        // On coupe par la fin : les événements récents sont les plus utiles.
        while (lines.length && Buffer.byteLength(lines.join('\n'), 'utf8') > HARD_SIZE_LIMIT) {
            lines.shift()
        }
        out = lines.join('\n')
        truncated = true
    }

    if (!purged && !truncated) {
        return
    }
    try {
        fs.writeFileSync(LOG_PATH, out, 'utf8')
        if (purged) {
            log(`retention: removed ${purged} line(s) older than ${days} days`)
        }
        if (truncated) {
            warn(`log truncated: reached the ${Math.round(HARD_SIZE_LIMIT / 1024 / 1024)} MB ceiling`)
        }
    } catch {
        // Journal non réinscriptible : on le laisse tel quel.
    }
}

/**
 * Vide le journal à la demande de l'utilisateur.
 *
 * La purge est elle-même journalisée : un fichier vide serait autrement
 * indiscernable d'un journal qui n'a jamais rien enregistré.
 */
export function purge (): void {
    // Une rafale en cours de dénombrement écrirait sa ligne de résumé après
    // coup, dans un fichier que l'utilisateur vient explicitement de vider —
    // elle est abandonnée plutôt que reportée : le contexte qu'elle résumait a
    // disparu avec le reste du journal.
    if (pending) {
        clearTimeout(pending.timer)
        pending = null
    }
    try {
        fs.writeFileSync(LOG_PATH, '', 'utf8')
    } catch {
        return
    }
    log('log purged manually from the settings')
}

/** Ouvre une session. Le nom de la machine figure ici, et pas sur chaque ligne. */
export function startSession (): void {
    const { machineName, enabled, logRetentionDays } = readSettings()
    const retention = logRetentionDays > 0 ? `${logRetentionDays} d` : 'unlimited'
    append('')
    write('INFO', `──── session opened — machine “${machineName}” — plugin ${enabled ? 'enabled' : 'disabled'} — retention ${retention}`)
}
