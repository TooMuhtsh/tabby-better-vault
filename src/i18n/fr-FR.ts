/**
 * Traductions françaises.
 *
 * LES CLÉS SONT LES CHAÎNES SOURCES ANGLAISES, au caractère près : c'est ainsi
 * que ngx-translate les retrouve. Une clé qui ne correspond plus exactement à la
 * source ne provoque aucune erreur — elle fait silencieusement retomber la
 * phrase sur l'anglais. En cas de doute, comparer avec `npm run lint:i18n`.
 *
 * PIÈGE ICU : ces chaînes traversent `TranslateMessageFormatCompiler`, pour
 * lequel l'apostrophe droite est un caractère d'échappement lorsqu'elle précède
 * une accolade. `jusqu'{date}` serait mangé ; `jusqu'au {date}` ne l'est pas.
 * Ne jamais coller une apostrophe à un paramètre — reformuler.
 */
export default {
    // Panneau de réglages — en-tête
    'Automatic vault unlocking': 'Déverrouillage automatique du coffre-fort',
    'Settings specific to this machine — never synchronised.': 'Réglages propres à cette machine — jamais synchronisés.',

    // Panneau de réglages — garde-fou déclenché
    'Keychain access suspended.': 'Accès au trousseau suspendu.',
    'The plugin no longer queries it, so that Tabby startup cannot freeze. Your master password is requested normally every time.': 'Le plugin ne le sollicite plus, pour ne pas figer le démarrage de Tabby. Le mot de passe reste demandé normalement à chaque fois.',
    'Unlock your keychain, then run the check below.': 'Déverrouillez votre trousseau, puis relancez la vérification ci-dessous.',
    'This check really encrypts and decrypts a throwaway value — that is the only way to know whether the keychain responds. If yours is still locked, your system will ask you to authenticate.': 'Cette vérification chiffre et déchiffre réellement une valeur jetable — c\'est le seul moyen de savoir si le trousseau répond. Si le vôtre est encore verrouillé, votre système vous demandera de vous authentifier.',
    'Lift the suspension and check': 'Lever la suspension et vérifier',

    // Panneau de réglages — trousseau non vérifié
    'System keychain not checked.': 'Trousseau du système non vérifié.',
    'The plugin does not query the keychain until it is enabled — that is what guarantees its mere presence cannot delay Tabby startup.': 'Le plugin n\'interroge pas le trousseau tant qu\'il n\'est pas activé — c\'est ce qui garantit que sa seule présence ne peut pas retarder le démarrage de Tabby.',
    'The check encrypts and decrypts a throwaway value. If your keychain is locked, your system will ask you to authenticate.': 'La vérification chiffre et déchiffre une valeur jetable. Si votre trousseau est verrouillé, votre système vous demandera de vous authentifier.',
    'Check the keychain': 'Vérifier le trousseau',

    // Panneau de réglages — trousseau indisponible
    'System keychain unavailable.': 'Trousseau du système indisponible.',
    'Restart Tabby before trying again: the keychain remembers this failure for as long as the application is running, so another check cannot reach it.': 'Redémarrez Tabby avant de réessayer : le trousseau garde la mémoire de cet échec tant que l\'application tourne, une nouvelle vérification ne l\'atteindrait donc pas.',
    'Automatic unlocking cannot work on this machine; the master password will keep being requested every time.': 'Le déverrouillage automatique ne peut pas fonctionner sur cette machine ; le mot de passe restera demandé à chaque fois.',
    'Settings that depend on it stay hidden while this lasts. The log and observation mode remain available, as does revocation if a password had been saved.': 'Les réglages qui en dépendent sont masqués tant que c\'est le cas. Le journal et le mode observation restent accessibles, ainsi que la révocation si un mot de passe avait été enregistré.',

    // Panneau de réglages — activation et machine
    'Enable on this machine': 'Activer sur cette machine',
    'The master password is encrypted with a key held by the operating system keychain, never stored in clear text.': 'Le mot de passe maître est chiffré à l\'aide d\'une clé détenue par le trousseau du système d\'exploitation, jamais stocké en clair.',
    'Name of this machine': 'Nom de cette machine',
    'Purely indicative — helps you find your way around the settings and the log.': 'Purement indicatif — sert à s\'y retrouver dans les réglages et le journal.',
    'home machine': 'poste maison',

    // Panneau de réglages — expiration
    'Expiry': 'Expiration',
    'Ask for the password again': 'Redemander le mot de passe',
    'Next due: {value}': 'Prochaine échéance : {value}',
    'At a fixed day and time': 'À jour et heure fixes',
    'After a delay': 'Après un délai',
    'Never': 'Jamais',
    'Every': 'Chaque',
    'Choosing a quiet slot avoids the re-entry falling in the middle of a work session.': 'Choisir un créneau creux évite que la ressaisie tombe en pleine session de travail.',
    '{hour}:00': '{hour} h',
    'Validity period': 'Durée de validité',
    'In days, counted from the last entry.': 'En jours, à compter de la dernière saisie.',

    // Panneau de réglages — mot de passe enregistré
    'Saved password': 'Mot de passe enregistré',
    'A password is saved on this machine': 'Un mot de passe est enregistré sur cette machine',
    'No password saved': 'Aucun mot de passe enregistré',
    'It will be forgotten on {date}, or immediately if you ask.': 'Il sera oublié le {date}, ou immédiatement si vous le demandez.',
    'It will be saved at the next manual entry, if the plugin is enabled.': 'Il sera enregistré à la prochaine saisie manuelle, si le plugin est activé.',
    'Forget now': 'Oublier maintenant',

    // Panneau de réglages — profils exclus
    'Excluded profiles': 'Profils exclus',
    'An excluded profile gets its password asked again at every connection, and that is all it does: the vault remains a single encrypted store, any profile that is not excluded still opens it automatically, and private key passphrases are outside this scope.': 'Un profil exclu voit son mot de passe redemandé à chaque connexion, et rien de plus : le coffre reste un magasin chiffré unique, tout profil non exclu l\'ouvre encore automatiquement, et les phrases secrètes des clés privées sont hors de ce périmètre.',
    'With an encrypted configuration, unlocking at startup also stays automatic — it happens before any profile exists. Excluding a group applies to the profiles it holds at that moment; one added afterwards is not excluded.': 'En configuration chiffrée, le déverrouillage au démarrage reste lui aussi automatique — il a lieu avant que le moindre profil existe. Exclure un groupe s\'applique aux profils qu\'il contient à cet instant ; un profil ajouté ensuite n\'est pas exclu.',
    'No SSH profile is defined in this configuration.': 'Aucun profil SSH n\'est défini dans cette configuration.',
    // Même libellé que la liste de profils de Tabby, qui traduit déjà ce msgid :
    // deux mots différents pour le même panier dérouteraient.
    'Ungrouped': 'Sans groupe',
    '{excluded} of {total} excluded': '{excluded} exclus sur {total}',
    'Exclude all': 'Tout exclure',
    'Include all': 'Tout réintégrer',

    // Panneau de réglages — journal
    'Log': 'Journal',
    'Observation mode': 'Mode observation',
    'Logs what happens without ever serving or saving a password. To diagnose safely.': 'Journalise le déroulement sans jamais servir ni enregistrer de mot de passe. Pour diagnostiquer sans risque.',
    'Entry retention': 'Conservation des entrées',
    'The log records vault openings, expiries and revocations. It never contains your password.': 'Le journal retrace les ouvertures du coffre, les expirations et les révocations. Il ne contient jamais votre mot de passe.',
    'File': 'Fichier',
    'Local to this machine, never synchronised. Never contains your password.': 'Local à cette machine, jamais synchronisé. Ne contient jamais votre mot de passe.',
    'Open': 'Ouvrir',
    'Purge': 'Purger',

    // Confirmation de purge du journal
    'Empty the log?': 'Vider le journal ?',
    'All history of vault openings, expiries and revocations will be lost. This action cannot be undone.': 'Tout l\'historique des ouvertures du coffre, des expirations et des révocations sera perdu. Cette action est irréversible.',
    'Empty': 'Vider',
    'Cancel': 'Annuler',

    // Jours et durées
    'Monday': 'Lundi',
    'Tuesday': 'Mardi',
    'Wednesday': 'Mercredi',
    'Thursday': 'Jeudi',
    'Friday': 'Vendredi',
    'Saturday': 'Samedi',
    'Sunday': 'Dimanche',
    '30 days': '30 jours',
    '90 days': '90 jours',
    '1 year': '1 an',
    'Unlimited': 'Illimitée',
    'no expiry': 'aucune expiration',

    // Notifications
    'Vault unlocked automatically': 'Coffre-fort déverrouillé automatiquement',
    'Could not confirm the saved password with the keychain': 'Impossible de confirmer le mot de passe enregistré auprès du trousseau',
    'Restart Tabby to give automatic unlocking another try. Your password will be asked once in the meantime — nothing was lost.': 'Relancez Tabby pour redonner sa chance au déverrouillage automatique. Le mot de passe sera redemandé une fois entre-temps — rien n\'a été perdu.',
    'Observation mode — nothing was saved': 'Mode observation — rien n\'a été enregistré',
    'Password saved in {keychain}': 'Mot de passe enregistré dans {keychain}',
    'Outside observation mode, the password would be entrusted to {keychain}. Valid until {date}.': 'Hors mode observation, le mot de passe serait confié à {keychain}. Valable jusqu\'au {date}.',
    'Outside observation mode, the password would be entrusted to {keychain}. Valid until revoked.': 'Hors mode observation, le mot de passe serait confié à {keychain}. Valable jusqu\'à révocation.',
    'Valid until {date}. Can be revoked at any time in Settings → Better Vault.': 'Valable jusqu\'au {date}. Révocable à tout moment dans Paramètres → Better Vault.',
    'Valid until you revoke it, at any time in Settings → Better Vault.': 'Valable jusqu\'à ce que vous le révoquiez, à tout moment dans Paramètres → Better Vault.',

    // Noms des coffres de l'OS — reprendre le terme officiel de l'éditeur,
    // jamais une traduction mot à mot.
    'the Windows Credential Manager': 'le Gestionnaire d\'identifiants de Windows',
    'the macOS Keychain': 'le Trousseau d\'accès de macOS',
    'the system keychain': 'le trousseau du système',

    // Motifs d'indisponibilité du trousseau (affichés ET journalisés en anglais)
    'Linux keychain unavailable (basic_text backend: hard-coded key, encryption is not trustworthy)': 'trousseau Linux indisponible (backend basic_text : clé codée en dur, chiffrement non fiable)',
    'the system offers no encryption (isEncryptionAvailable=false)': 'le système n\'offre pas de chiffrement (isEncryptionAvailable=false)',
    'the keychain responded, but the encryption round trip does not return the original value': 'le trousseau a répondu, mais l\'aller-retour de chiffrement ne redonne pas la valeur d\'origine',
    'safeStorage is unusable — {error}': 'safeStorage inutilisable — {error}',
    'the keychain did not honour the round trip — {error}': 'le trousseau n\'a pas honoré l\'aller-retour — {error}',
    'the keychain guard cannot be armed ({error}) — access refused as a precaution': 'garde-fou du trousseau non armable ({error}) — accès refusé par précaution',

    // Opérations, telles qu'elles sont nommées dans la phrase du garde-fou
    'keychain diagnosis': 'diagnostic du trousseau',
    'keychain verification': 'vérification du trousseau',
    'saving the password': 'enregistrement du mot de passe',
    'reading the password back': 'relecture du mot de passe',

    // Phrases du garde-fou
    'the operation “{operation}” never returned on {date} — the keychain is probably locked': 'l\'opération « {operation} » n\'est jamais revenue le {date} — le trousseau est probablement verrouillé',
    'the operation “{operation}” never returned — the keychain is probably locked': 'l\'opération « {operation} » n\'est jamais revenue — le trousseau est probablement verrouillé',
    'a keychain access never returned on {date} — the keychain is probably locked': 'un accès au trousseau n\'est jamais revenu le {date} — le trousseau est probablement verrouillé',
    'a keychain access never returned — the keychain is probably locked': 'un accès au trousseau n\'est jamais revenu — le trousseau est probablement verrouillé',
}
