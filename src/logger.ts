import * as fs from 'fs'
import * as path from 'path'

import { configDir } from './tabbyConfig'

/**
 * Journal du plugin.
 *
 * Écrit à la fois dans la console DevTools et dans un fichier, pour que le
 * diagnostic soit récupérable sans avoir à ouvrir le débogueur (Tabby avale
 * silencieusement beaucoup d'erreurs de chargement de plugin — piège hérité #8).
 *
 * IMPORTANT : ce journal ne doit JAMAIS recevoir le mot de passe maître, ni une
 * valeur qui permettrait de le reconstituer (sa longueur comprise).
 */

const T0 = Date.now()

export const LOG_PATH = path.join(configDir(), 'better-vault.log')

export function log (message: string): void {
    const line = `[+${String(Date.now() - T0).padStart(6)}ms] ${message}`
    // eslint-disable-next-line no-console
    console.log('[better-vault]', line)
    try {
        fs.appendFileSync(LOG_PATH, line + '\n', 'utf8')
    } catch {
        // Un journal indisponible ne doit jamais faire échouer le plugin.
    }
}

/** Démarre une nouvelle session dans le fichier de journal. */
export function startSession (): void {
    try {
        fs.appendFileSync(
            LOG_PATH,
            `\n===== session ${new Date().toISOString()} | tabby-better-vault =====\n`,
            'utf8',
        )
    } catch {
        // idem
    }
}
