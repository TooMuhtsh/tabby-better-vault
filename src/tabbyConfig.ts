import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as yaml from 'js-yaml'

/** Forme du coffre chiffré tel que Tabby le stocke dans config.yaml. */
export interface StoredVault {
    version: number
    contents: string
    keySalt: string
    iv: string
}

export function configDir (): string {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'tabby')
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'tabby')
    }
    return path.join(os.homedir(), '.config', 'tabby')
}

/**
 * Lit le coffre chiffré directement dans config.yaml.
 *
 * Pourquoi ne pas simplement lire `VaultService.store` ? Parce qu'il est encore
 * `null` au moment qui compte : quand la config elle-même est chiffrée, Tabby
 * appelle getPassphrase() depuis `ConfigService.maybeDecryptConfig()`, donc
 * AVANT `vault.setStore()`. Lire le fichier est le seul moyen de disposer du
 * coffre dans les deux régimes (config chiffrée ou non) et donc de valider un
 * mot de passe avant de le servir.
 *
 * La clé `vault:` reste en clair à la racine du fichier même quand
 * `encrypted: true` — c'est justement ce qui permet à Tabby de déchiffrer sa
 * propre config au démarrage.
 */
export function readStoredVault (): StoredVault | null {
    try {
        const raw = fs.readFileSync(path.join(configDir(), 'config.yaml'), 'utf8')
        const parsed = yaml.load(raw) as any
        const vault = parsed?.vault
        if (!vault?.contents || !vault.keySalt || !vault.iv) {
            return null
        }
        return vault as StoredVault
    } catch {
        return null
    }
}
