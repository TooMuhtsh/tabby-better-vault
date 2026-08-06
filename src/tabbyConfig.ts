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

function fixedConfigDir (): string {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'tabby')
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'tabby')
    }
    return path.join(os.homedir(), '.config', 'tabby')
}

/**
 * Résolu une seule fois : `userData` ne change pas pendant la vie du processus,
 * et cette fonction est appelée à chaque lecture/écriture de réglages — sur le
 * chemin de `getPassphrase()`, donc potentiellement plusieurs fois par seconde
 * (voir ROADMAP.html § Journal saturé). Refaire l'aller-retour IPC à chaque fois
 * serait un coût inutile, ajouté sur un chemin déjà chargé.
 */
let cachedConfigDir: string | null = null

/**
 * Dossier de configuration de CETTE instance de Tabby.
 *
 * Ignorait jusqu'ici `--user-data-dir` (et tout profil alternatif) en
 * recalculant toujours l'emplacement par défaut. Mesuré : une instance lancée
 * avec un profil distinct chargeait le plugin et écrivait sa ligne de journal
 * dans le profil par défaut, aucun `better-vault.log` n'apparaissant dans son
 * propre profil — avec trois conséquences, dont la plus grave : un témoin de
 * `keychainGuard.ts` partagé entre profils, qui rendait D4 reproductible à
 * volonté (ROADMAP.html § Deux sujets de conception).
 *
 * `app.getPath('userData')` est ce que Tabby interroge lui-même pour ce même
 * usage. C'est un simple accès à une propriété côté processus principal via
 * `@electron/remote` — pas un pont vers `safeStorage` — donc rien à protéger par
 * le garde-fou de `keychainGuard.ts` ici : cet appel ne bloque jamais en
 * attendant une réponse de l'utilisateur.
 *
 * Repli sur le calcul figé si `@electron/remote` est inatteignable : mêmes
 * circonstances que celles déjà traitées dans `osKeychain.ts`, pour ne jamais
 * transformer un dossier introuvable en panne du plugin. Sur le profil par
 * défaut, les deux chemins coïncident ; ailleurs, seul celui-ci est correct.
 */
export function configDir (): string {
    if (cachedConfigDir) {
        return cachedConfigDir
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const remote = require('@electron/remote')
        const userData = remote?.app?.getPath?.('userData')
        if (typeof userData === 'string' && userData) {
            cachedConfigDir = userData
            return cachedConfigDir
        }
    } catch {
        // @electron/remote inatteignable : repli.
    }
    cachedConfigDir = fixedConfigDir()
    return cachedConfigDir
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
