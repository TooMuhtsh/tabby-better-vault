import * as crypto from 'crypto'
import { promisify } from 'util'

import { StoredVault } from './tabbyConfig'

/**
 * Réplique locale du déchiffrement de coffre de Tabby, utilisée UNIQUEMENT pour
 * vérifier qu'un mot de passe est le bon avant de le servir.
 *
 * Pourquoi ne pas appeler `vault.decrypt()` ou `vault.load()` de Tabby ?
 *
 *   1. RÉCURSION INFINIE. Les deux retombent sur `this.getPassphrase()` — qui
 *      est précisément la méthode que ce plugin remplace. Ne « simplifiez » pas
 *      ce fichier en appelant l'API native : le plugin se bloquerait au
 *      démarrage.
 *   2. Effets de bord. `decrypt()` appelle `forgetPassphrase()` et affiche une
 *      notification « Incorrect passphrase » en cas d'échec. Notre vérification
 *      doit être silencieuse : un token périmé se purge sans déranger
 *      l'utilisateur.
 *
 * Paramètres copiés de tabby-core/src/services/vault.service.ts. S'ils changent
 * un jour côté Tabby, la vérification échouera systématiquement — la
 * dégradation est sûre (token purgé, retour à la saisie manuelle), mais le
 * déverrouillage automatique cessera de fonctionner en silence.
 * Voir .AIRules/AI-CONTEXT.html, piège #V10.
 */
const PBKDF_ITERATIONS = 100000
const PBKDF_DIGEST = 'sha512'
const CRYPT_ALG = 'aes-256-cbc'
const CRYPT_KEY_LENGTH = 256 / 8

export async function passphraseOpensVault (store: StoredVault, passphrase: string): Promise<boolean> {
    if (store.version !== 1) {
        return false
    }
    try {
        const key = await promisify(crypto.pbkdf2)(
            Buffer.from(passphrase),
            Buffer.from(store.keySalt, 'hex'),
            PBKDF_ITERATIONS,
            CRYPT_KEY_LENGTH,
            PBKDF_DIGEST,
        )
        const decipher = crypto.createDecipheriv(CRYPT_ALG, key, Buffer.from(store.iv, 'hex'))
        const plaintext = decipher.update(Buffer.from(store.contents, 'base64'), undefined, 'utf-8') + decipher.final('utf-8')
        // Un mauvais mot de passe fait échouer `final()` (padding invalide).
        // On vérifie tout de même que le résultat est du JSON, pour ne pas
        // dépendre uniquement de la détection de padding.
        JSON.parse(plaintext)
        return true
    } catch {
        return false
    }
}
