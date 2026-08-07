/**
 * Traductions allemandes.
 *
 * Voir `fr-FR.ts` pour la règle sur les clés — chaînes sources anglaises au
 * caractère près — et pour le piège de l'apostrophe devant un paramètre ICU.
 */
export default {
    // Panneau de réglages — en-tête
    'Automatic vault unlocking': 'Automatisches Entsperren des Tresors',
    'Settings specific to this machine — never synchronised.': 'Einstellungen nur für diesen Rechner – werden nie synchronisiert.',

    // Panneau de réglages — garde-fou déclenché
    'Keychain access suspended.': 'Zugriff auf den Schlüsselbund ausgesetzt.',
    'The plugin no longer queries it, so that Tabby startup cannot freeze. Your master password is requested normally every time.': 'Das Plugin fragt ihn nicht mehr ab, damit der Start von Tabby nicht einfriert. Das Master-Passwort wird weiterhin jedes Mal normal abgefragt.',
    'Unlock your keychain, then run the check below.': 'Entsperren Sie Ihren Schlüsselbund und starten Sie anschließend die Prüfung unten.',
    'This check really encrypts and decrypts a throwaway value — that is the only way to know whether the keychain responds. If yours is still locked, your system will ask you to authenticate.': 'Diese Prüfung ver- und entschlüsselt tatsächlich einen Wegwerfwert – nur so lässt sich feststellen, ob der Schlüsselbund antwortet. Ist Ihrer noch gesperrt, verlangt Ihr System eine Authentifizierung.',
    'Lift the suspension and check': 'Aussetzung aufheben und prüfen',

    // Panneau de réglages — trousseau non vérifié
    'System keychain not checked.': 'Schlüsselbund des Systems nicht geprüft.',
    'The plugin does not query the keychain until it is enabled — that is what guarantees its mere presence cannot delay Tabby startup.': 'Das Plugin fragt den Schlüsselbund erst ab, wenn es aktiviert ist – das garantiert, dass seine bloße Anwesenheit den Start von Tabby nicht verzögern kann.',
    'The check encrypts and decrypts a throwaway value. If your keychain is locked, your system will ask you to authenticate.': 'Die Prüfung ver- und entschlüsselt einen Wegwerfwert. Ist Ihr Schlüsselbund gesperrt, verlangt Ihr System eine Authentifizierung.',
    'Check the keychain': 'Schlüsselbund prüfen',

    // Panneau de réglages — trousseau indisponible
    'System keychain unavailable.': 'Schlüsselbund des Systems nicht verfügbar.',
    'Restart Tabby before trying again: the keychain remembers this failure for as long as the application is running, so another check cannot reach it.': 'Starten Sie Tabby neu, bevor Sie es erneut versuchen: Der Schlüsselbund merkt sich diesen Fehlschlag, solange die Anwendung läuft — eine weitere Prüfung erreicht ihn daher nicht.',
    'Automatic unlocking cannot work on this machine; the master password will keep being requested every time.': 'Das automatische Entsperren kann auf diesem Rechner nicht funktionieren; das Master-Passwort wird weiterhin jedes Mal abgefragt.',
    'Settings that depend on it stay hidden while this lasts. The log and observation mode remain available, as does revocation if a password had been saved.': 'Die davon abhängigen Einstellungen bleiben so lange ausgeblendet. Protokoll und Beobachtungsmodus bleiben verfügbar, ebenso der Widerruf, falls ein Passwort gespeichert war.',

    // Panneau de réglages — activation et machine
    'Enable on this machine': 'Auf diesem Rechner aktivieren',
    'The master password is encrypted with a key held by the operating system keychain, never stored in clear text.': 'Das Master-Passwort wird mit einem vom Schlüsselbund des Betriebssystems verwahrten Schlüssel verschlüsselt, niemals im Klartext gespeichert.',
    'Name of this machine': 'Name dieses Rechners',
    'Purely indicative — helps you find your way around the settings and the log.': 'Rein informativ – dient der Orientierung in den Einstellungen und im Protokoll.',
    'home machine': 'Rechner zu Hause',

    // Panneau de réglages — expiration
    'Expiry': 'Ablauf',
    'Ask for the password again': 'Passwort erneut abfragen',
    'Next due: {value}': 'Nächste Fälligkeit: {value}',
    'At a fixed day and time': 'An festem Tag und fester Uhrzeit',
    'After a delay': 'Nach einer Frist',
    'Never': 'Nie',
    'Every': 'Jeden',
    'Choosing a quiet slot avoids the re-entry falling in the middle of a work session.': 'Ein ruhiges Zeitfenster verhindert, dass die erneute Eingabe mitten in eine Arbeitssitzung fällt.',
    '{hour}:00': '{hour}:00 Uhr',
    'Validity period': 'Gültigkeitsdauer',
    'In days, counted from the last entry.': 'In Tagen, gerechnet ab der letzten Eingabe.',

    // Panneau de réglages — mot de passe enregistré
    'Saved password': 'Gespeichertes Passwort',
    'A password is saved on this machine': 'Auf diesem Rechner ist ein Passwort gespeichert',
    'No password saved': 'Kein Passwort gespeichert',
    'It will be forgotten on {date}, or immediately if you ask.': 'Es wird am {date} vergessen – oder sofort, wenn Sie es verlangen.',
    'It will be saved at the next manual entry, if the plugin is enabled.': 'Es wird bei der nächsten manuellen Eingabe gespeichert, sofern das Plugin aktiviert ist.',
    'Forget now': 'Jetzt vergessen',

    // Panneau de réglages — profils exclus
    'Excluded profiles': 'Ausgeschlossene Profile',
    'An excluded profile gets its password asked again at every connection, and that is all it does: the vault remains a single encrypted store, any profile that is not excluded still opens it automatically, and private key passphrases are outside this scope.': 'Bei einem ausgeschlossenen Profil wird das Passwort bei jeder Verbindung wieder abgefragt, mehr nicht: Der Tresor bleibt ein einziger verschlüsselter Speicher, jedes nicht ausgeschlossene Profil öffnet ihn weiterhin automatisch, und Passphrasen privater Schlüssel liegen außerhalb dieses Rahmens.',
    'With an encrypted configuration, unlocking at startup also stays automatic — it happens before any profile exists. Excluding a group applies to the profiles it holds at that moment; one added afterwards is not excluded.': 'Bei verschlüsselter Konfiguration bleibt auch das Entsperren beim Start automatisch – es erfolgt, bevor überhaupt ein Profil existiert. Der Ausschluss einer Gruppe gilt für die Profile, die sie in diesem Moment enthält; ein später hinzugefügtes Profil ist nicht ausgeschlossen.',
    'No SSH profile is defined in this configuration.': 'In dieser Konfiguration ist kein SSH-Profil definiert.',
    // Même libellé que la liste de profils de Tabby, qui traduit déjà ce msgid :
    // deux mots différents pour le même panier dérouteraient.
    'Ungrouped': 'Nicht gruppiert',
    '{excluded} of {total} excluded': '{excluded} von {total} ausgeschlossen',
    'Exclude all': 'Alle ausschließen',
    'Include all': 'Alle wieder einbeziehen',

    // Panneau de réglages — journal
    'Log': 'Protokoll',
    'Observation mode': 'Beobachtungsmodus',
    'Logs what happens without ever serving or saving a password. To diagnose safely.': 'Protokolliert den Ablauf, ohne jemals ein Passwort auszuliefern oder zu speichern. Für gefahrloses Diagnostizieren.',
    'Entry retention': 'Aufbewahrung der Einträge',
    'The log records vault openings, expiries and revocations. It never contains your password.': 'Das Protokoll hält Tresoröffnungen, Abläufe und Widerrufe fest. Es enthält niemals Ihr Passwort.',
    'File': 'Datei',
    'Local to this machine, never synchronised. Never contains your password.': 'Lokal auf diesem Rechner, wird nie synchronisiert. Enthält niemals Ihr Passwort.',
    'Open': 'Öffnen',
    'Purge': 'Leeren',

    // Confirmation de purge du journal
    'Empty the log?': 'Protokoll leeren?',
    'All history of vault openings, expiries and revocations will be lost. This action cannot be undone.': 'Der gesamte Verlauf der Tresoröffnungen, Abläufe und Widerrufe geht verloren. Diese Aktion lässt sich nicht rückgängig machen.',
    'Empty': 'Leeren',
    'Cancel': 'Abbrechen',

    // Jours et durées
    'Monday': 'Montag',
    'Tuesday': 'Dienstag',
    'Wednesday': 'Mittwoch',
    'Thursday': 'Donnerstag',
    'Friday': 'Freitag',
    'Saturday': 'Samstag',
    'Sunday': 'Sonntag',
    '30 days': '30 Tage',
    '90 days': '90 Tage',
    '1 year': '1 Jahr',
    'Unlimited': 'Unbegrenzt',
    'no expiry': 'kein Ablauf',

    // Notifications
    'Vault unlocked automatically': 'Tresor automatisch entsperrt',
    'Could not confirm the saved password with the keychain': 'Das gespeicherte Passwort konnte nicht beim Schlüsselbund bestätigt werden',
    'Restart Tabby to give automatic unlocking another try. Your password will be asked once in the meantime — nothing was lost.': 'Starten Sie Tabby neu, um dem automatischen Entsperren eine weitere Chance zu geben. In der Zwischenzeit wird Ihr Passwort einmal abgefragt – nichts ist verloren gegangen.',
    'Observation mode — nothing was saved': 'Beobachtungsmodus – es wurde nichts gespeichert',
    'Password saved in {keychain}': 'Passwort gespeichert in {keychain}',
    'Outside observation mode, the password would be entrusted to {keychain}. Valid until {date}.': 'Außerhalb des Beobachtungsmodus würde das Passwort {keychain} anvertraut. Gültig bis {date}.',
    'Outside observation mode, the password would be entrusted to {keychain}. Valid until revoked.': 'Außerhalb des Beobachtungsmodus würde das Passwort {keychain} anvertraut. Gültig bis zum Widerruf.',
    'Valid until {date}. Can be revoked at any time in Settings → Better Vault.': 'Gültig bis {date}. Jederzeit widerrufbar unter Einstellungen → Better Vault.',
    'Valid until you revoke it, at any time in Settings → Better Vault.': 'Gültig, bis Sie es widerrufen – jederzeit unter Einstellungen → Better Vault.',

    // Noms des coffres de l'OS — terme officiel de l'éditeur. Au datif, imposé
    // par « anvertraut » et « gespeichert in » dans les phrases ci-dessus.
    'the Windows Credential Manager': 'der Windows-Anmeldeinformationsverwaltung',
    'the macOS Keychain': 'dem macOS-Schlüsselbund',
    'the system keychain': 'dem Schlüsselbund des Systems',

    // Motifs d'indisponibilité du trousseau
    'Linux keychain unavailable (basic_text backend: hard-coded key, encryption is not trustworthy)': 'Linux-Schlüsselbund nicht verfügbar (Backend basic_text: fest einprogrammierter Schlüssel, Verschlüsselung nicht vertrauenswürdig)',
    'the system offers no encryption (isEncryptionAvailable=false)': 'das System bietet keine Verschlüsselung (isEncryptionAvailable=false)',
    'the keychain responded, but the encryption round trip does not return the original value': 'der Schlüsselbund hat geantwortet, aber der Ver- und Entschlüsselungsdurchlauf liefert nicht den ursprünglichen Wert zurück',
    'safeStorage is unusable — {error}': 'safeStorage unbrauchbar – {error}',
    'the keychain did not honour the round trip — {error}': 'der Schlüsselbund hat den Ver- und Entschlüsselungsdurchlauf nicht bedient – {error}',
    'the keychain guard cannot be armed ({error}) — access refused as a precaution': 'die Schlüsselbund-Absicherung lässt sich nicht scharfschalten ({error}) – Zugriff vorsorglich verweigert',

    // Opérations, telles qu'elles sont nommées dans la phrase du garde-fou
    'keychain diagnosis': 'Diagnose des Schlüsselbunds',
    'keychain verification': 'Prüfung des Schlüsselbunds',
    'saving the password': 'Speichern des Passworts',
    'reading the password back': 'Zurücklesen des Passworts',

    // Phrases du garde-fou
    'the operation “{operation}” never returned on {date} — the keychain is probably locked': 'der Vorgang „{operation}“ ist am {date} nie zurückgekehrt – der Schlüsselbund ist vermutlich gesperrt',
    'the operation “{operation}” never returned — the keychain is probably locked': 'der Vorgang „{operation}“ ist nie zurückgekehrt – der Schlüsselbund ist vermutlich gesperrt',
    'a keychain access never returned on {date} — the keychain is probably locked': 'ein Zugriff auf den Schlüsselbund ist am {date} nie zurückgekehrt – der Schlüsselbund ist vermutlich gesperrt',
    'a keychain access never returned — the keychain is probably locked': 'ein Zugriff auf den Schlüsselbund ist nie zurückgekehrt – der Schlüsselbund ist vermutlich gesperrt',
}
