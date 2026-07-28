import * as fs from 'fs'
import * as path from 'path'

import { configDir } from './tabbyConfig'

/**
 * Stockage du jeton chiffré, DÉLIBÉRÉMENT hors de config.yaml.
 *
 * La raison n'est pas la confidentialité — un blob chiffré par le keychain de
 * l'OS est inexploitable sur une autre machine, et même sur un autre compte
 * utilisateur sous Windows (DPAPI). La raison est fonctionnelle : la
 * synchronisation de config de Tabby (`readConfigDataForSync`) envoie
 * l'INTÉGRALITÉ de config.yaml sauf la clé `configSync`, et
 * `writeConfigDataFromSync` écrase le fichier local par la version distante.
 *
 * Un jeton propre à une machine placé dans config.yaml provoquerait une boucle
 * de destruction mutuelle entre machines : B reçoit le jeton de A, échoue à le
 * déchiffrer, le purge, resynchronise — et A perd le sien. Chaque machine
 * effacerait celui de l'autre, indéfiniment.
 *
 * Ce fichier ne doit donc JAMAIS être déplacé dans config.yaml ni ajouté à un
 * quelconque mécanisme d'export ou de partage.
 * Voir .AIRules/ROADMAP.html#stockage.
 */
const TOKEN_FILENAME = 'better-vault-token.bin'

function tokenPath (): string {
    return path.join(configDir(), TOKEN_FILENAME)
}

export function readToken (): Buffer | null {
    try {
        const data = fs.readFileSync(tokenPath())
        return data.length ? data : null
    } catch {
        return null
    }
}

export function writeToken (blob: Buffer): void {
    // mode 0600 : lisible par le seul propriétaire (sans effet réel sur
    // Windows, où la protection vient de DPAPI lui-même).
    fs.writeFileSync(tokenPath(), blob, { mode: 0o600 })
}

export function deleteToken (): void {
    try {
        fs.unlinkSync(tokenPath())
    } catch {
        // Absent ou déjà supprimé : rien à faire.
    }
}

export function tokenExists (): boolean {
    return readToken() !== null
}
