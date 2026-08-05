/**
 * Traductions espagnoles.
 *
 * Voir `fr-FR.ts` pour la règle sur les clés — chaînes sources anglaises au
 * caractère près — et pour le piège de l'apostrophe devant un paramètre ICU.
 */
export default {
    // Panneau de réglages — en-tête
    'Automatic vault unlocking': 'Desbloqueo automático de la caja fuerte',
    'Settings specific to this machine — never synchronised.': 'Ajustes propios de este equipo: nunca se sincronizan.',

    // Panneau de réglages — garde-fou déclenché
    'Keychain access suspended.': 'Acceso al llavero suspendido.',
    'The plugin no longer queries it, so that Tabby startup cannot freeze. Your master password is requested normally every time.': 'El complemento ya no lo consulta, para no bloquear el arranque de Tabby. La contraseña maestra se sigue pidiendo con normalidad cada vez.',
    'Unlock your keychain, then run the check below.': 'Desbloquea el llavero y vuelve a ejecutar la comprobación de abajo.',
    'This check really encrypts and decrypts a throwaway value — that is the only way to know whether the keychain responds. If yours is still locked, your system will ask you to authenticate.': 'Esta comprobación cifra y descifra realmente un valor desechable: es la única forma de saber si el llavero responde. Si el tuyo sigue bloqueado, el sistema te pedirá autenticarte.',
    'Lift the suspension and check': 'Levantar la suspensión y comprobar',

    // Panneau de réglages — trousseau non vérifié
    'System keychain not checked.': 'Llavero del sistema sin comprobar.',
    'The plugin does not query the keychain until it is enabled — that is what guarantees its mere presence cannot delay Tabby startup.': 'El complemento no consulta el llavero mientras no esté activado: eso es lo que garantiza que su mera presencia no pueda retrasar el arranque de Tabby.',
    'The check encrypts and decrypts a throwaway value. If your keychain is locked, your system will ask you to authenticate.': 'La comprobación cifra y descifra un valor desechable. Si el llavero está bloqueado, el sistema te pedirá autenticarte.',
    'Check the keychain': 'Comprobar el llavero',

    // Panneau de réglages — trousseau indisponible
    'System keychain unavailable.': 'Llavero del sistema no disponible.',
    'Restart Tabby before trying again: the keychain remembers this failure for as long as the application is running, so another check cannot reach it.': 'Reinicie Tabby antes de volver a intentarlo: el llavero recuerda este fallo mientras la aplicación siga en ejecución, por lo que otra comprobación no llegaría a él.',
    'Automatic unlocking cannot work on this machine; the master password will keep being requested every time.': 'El desbloqueo automático no puede funcionar en este equipo; la contraseña maestra se seguirá pidiendo cada vez.',
    'Settings that depend on it stay hidden while this lasts. The log and observation mode remain available, as does revocation if a password had been saved.': 'Los ajustes que dependen de él permanecen ocultos mientras esto dure. El registro y el modo observación siguen disponibles, igual que la revocación si se había guardado una contraseña.',

    // Panneau de réglages — activation et machine
    'Enable on this machine': 'Activar en este equipo',
    'The master password is encrypted with a key held by the operating system keychain, never stored in clear text.': 'La contraseña maestra se cifra con una clave que guarda el llavero del sistema operativo, nunca se guarda en claro.',
    'Name of this machine': 'Nombre de este equipo',
    'Purely indicative — helps you find your way around the settings and the log.': 'Meramente indicativo: sirve para orientarse en los ajustes y en el registro.',
    'home machine': 'equipo de casa',

    // Panneau de réglages — expiration
    'Expiry': 'Caducidad',
    'Ask for the password again': 'Volver a pedir la contraseña',
    'Next due: {value}': 'Próximo vencimiento: {value}',
    'At a fixed day and time': 'En un día y una hora fijos',
    'After a delay': 'Tras un plazo',
    'Never': 'Nunca',
    'Every': 'Cada',
    'Choosing a quiet slot avoids the re-entry falling in the middle of a work session.': 'Elegir una franja tranquila evita que la reintroducción caiga en plena sesión de trabajo.',
    '{hour}:00': '{hour}:00',
    'Validity period': 'Periodo de validez',
    'In days, counted from the last entry.': 'En días, contados desde la última introducción.',

    // Panneau de réglages — mot de passe enregistré
    'Saved password': 'Contraseña guardada',
    'A password is saved on this machine': 'Hay una contraseña guardada en este equipo',
    'No password saved': 'No hay ninguna contraseña guardada',
    'It will be forgotten on {date}, or immediately if you ask.': 'Se olvidará el {date}, o de inmediato si lo pides.',
    'It will be saved at the next manual entry, if the plugin is enabled.': 'Se guardará en la próxima introducción manual, si el complemento está activado.',
    'Forget now': 'Olvidar ahora',

    // Panneau de réglages — journal
    'Log': 'Registro',
    'Observation mode': 'Modo observación',
    'Logs what happens without ever serving or saving a password. To diagnose safely.': 'Registra lo que ocurre sin llegar nunca a servir ni guardar una contraseña. Para diagnosticar sin riesgo.',
    'Entry retention': 'Conservación de las entradas',
    'The log records vault openings, expiries and revocations. It never contains your password.': 'El registro recoge las aperturas de la caja fuerte, las caducidades y las revocaciones. Nunca contiene tu contraseña.',
    'File': 'Archivo',
    'Local to this machine, never synchronised. Never contains your password.': 'Local a este equipo, nunca se sincroniza. Nunca contiene tu contraseña.',
    'Open': 'Abrir',
    'Purge': 'Purgar',

    // Confirmation de purge du journal
    'Empty the log?': '¿Vaciar el registro?',
    'All history of vault openings, expiries and revocations will be lost. This action cannot be undone.': 'Se perderá todo el historial de aperturas de la caja fuerte, caducidades y revocaciones. Esta acción no se puede deshacer.',
    'Empty': 'Vaciar',
    'Cancel': 'Cancelar',

    // Jours et durées
    'Monday': 'Lunes',
    'Tuesday': 'Martes',
    'Wednesday': 'Miércoles',
    'Thursday': 'Jueves',
    'Friday': 'Viernes',
    'Saturday': 'Sábado',
    'Sunday': 'Domingo',
    '30 days': '30 días',
    '90 days': '90 días',
    '1 year': '1 año',
    'Unlimited': 'Ilimitada',
    'no expiry': 'sin caducidad',

    // Notifications
    'Vault unlocked automatically': 'Caja fuerte desbloqueada automáticamente',
    'Observation mode — nothing was saved': 'Modo observación: no se ha guardado nada',
    'Password saved in {keychain}': 'Contraseña guardada en {keychain}',
    'Outside observation mode, the password would be entrusted to {keychain}. Valid until {date}.': 'Fuera del modo observación, la contraseña se confiaría a {keychain}. Válida hasta el {date}.',
    'Outside observation mode, the password would be entrusted to {keychain}. Valid until revoked.': 'Fuera del modo observación, la contraseña se confiaría a {keychain}. Válida hasta su revocación.',
    'Valid until {date}. Can be revoked at any time in Settings → Better Vault.': 'Válida hasta el {date}. Revocable en cualquier momento en Ajustes → Better Vault.',
    'Valid until you revoke it, at any time in Settings → Better Vault.': 'Válida hasta que la revoques, en cualquier momento en Ajustes → Better Vault.',

    // Noms des coffres de l'OS — terme officiel de l'éditeur
    'the Windows Credential Manager': 'el Administrador de credenciales de Windows',
    'the macOS Keychain': 'el Llavero de macOS',
    'the system keychain': 'el llavero del sistema',

    // Motifs d'indisponibilité du trousseau
    'Linux keychain unavailable (basic_text backend: hard-coded key, encryption is not trustworthy)': 'llavero de Linux no disponible (backend basic_text: clave codificada en el programa, cifrado poco fiable)',
    'the system offers no encryption (isEncryptionAvailable=false)': 'el sistema no ofrece cifrado (isEncryptionAvailable=false)',
    'the keychain responded, but the encryption round trip does not return the original value': 'el llavero respondió, pero el ciclo de cifrado y descifrado no devuelve el valor original',
    'safeStorage is unusable — {error}': 'safeStorage inutilizable: {error}',
    'the keychain did not honour the round trip — {error}': 'el llavero no completó el ciclo de cifrado y descifrado: {error}',
    'the keychain guard cannot be armed ({error}) — access refused as a precaution': 'no se puede armar la salvaguarda del llavero ({error}): acceso denegado por precaución',

    // Opérations, telles qu'elles sont nommées dans la phrase du garde-fou
    'keychain diagnosis': 'diagnóstico del llavero',
    'keychain verification': 'verificación del llavero',
    'saving the password': 'guardado de la contraseña',
    'reading the password back': 'relectura de la contraseña',

    // Phrases du garde-fou
    'the operation “{operation}” never returned on {date} — the keychain is probably locked': 'la operación «{operation}» nunca regresó el {date}: el llavero probablemente esté bloqueado',
    'the operation “{operation}” never returned — the keychain is probably locked': 'la operación «{operation}» nunca regresó: el llavero probablemente esté bloqueado',
    'a keychain access never returned on {date} — the keychain is probably locked': 'un acceso al llavero nunca regresó el {date}: el llavero probablemente esté bloqueado',
    'a keychain access never returned — the keychain is probably locked': 'un acceso al llavero nunca regresó: el llavero probablemente esté bloqueado',
}
