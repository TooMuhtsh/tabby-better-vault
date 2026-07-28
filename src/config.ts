import { ConfigProvider } from 'tabby-core'

/**
 * Réglages persistés dans config.yaml sous la clé `betterVault`.
 *
 * ATTENTION : toute nouvelle clé doit être déclarée ici, MÊME vide. Une clé non
 * déclarée se mute très bien en mémoire mais n'est jamais écrite dans
 * config.yaml — silencieusement, sans la moindre erreur (piège hérité #16 du
 * projet frère).
 *
 * Le jeton chiffré ne figure volontairement PAS ici : il vit dans un fichier
 * séparé, voir src/tokenStore.ts.
 */
export class BetterVaultConfigProvider extends ConfigProvider {
    defaults = {
        betterVault: {
            /**
             * Opt-in strict. Tant que ce réglage est à false, le plugin
             * n'observe rien, ne capture rien et ne touche à rien.
             */
            enabled: false,
            /**
             * Mode observation : journalise le déroulement sans jamais servir
             * ni capturer de mot de passe. Sert à diagnostiquer sans risque,
             * notamment le cas « config chiffrée » encore peu observé.
             */
            debug: false,
        },
    }
}
