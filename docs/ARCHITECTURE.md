# Architecture & security — tabby-better-vault

Technical detail for people who want to know exactly what this plugin does
before trusting it with a master passphrase, or who are debugging it. The
[README](../README.md) covers what it does and how to install it; this
document covers how, and what it costs you.

## How it works

**Tabby exposes no API to inject the master passphrase.** Its cache is a
module-scoped variable, deliberately kept out of reach of `VaultService`
fields. The only workable approach is to replace `getPassphrase` on the
service instance obtained from the shared Angular injector — the same
approach [tabby-vault-keepassxc](https://github.com/chomoe327/tabby-vault-keepassxc)
takes. This is **not a documented extension point**, and it may break when
Tabby updates.

A few consequences worth knowing about:

- **The passphrase is verified before being used.** The plugin re-implements
  Tabby's vault decryption locally to check the stored passphrase actually
  opens the vault. Calling Tabby's own `decrypt()` would recurse straight back
  into `getPassphrase` — our own function — and deadlock startup.
- **Settings live outside `config.yaml`.** With configuration encryption on,
  everything but `vault`, `encrypted` and `configSync` sits inside the
  encrypted blob — including this plugin's own settings, which would then
  require the very passphrase we exist to supply. State is kept in
  `better-vault.json` next to `config.yaml`.
- **That file is never synchronised.** Tabby's config sync uploads all of
  `config.yaml` and overwrites the local copy with the remote one. A
  machine-specific token stored there would make two machines wipe each
  other's token in a loop. Keeping it separate also means each machine
  naturally has its own settings.
- **The plaintext passphrase never outlives a call.** It is never cached,
  never written to a field, never logged — not even its length.

## Security

| | |
|---|---|
| **What is stored** | Your vault master passphrase, encrypted by the OS keychain |
| **Where** | `better-vault.json` in Tabby's config directory, alongside `config.yaml` |
| **Who can read it** | On Windows, only your user account on this machine (DPAPI is user-scoped); on macOS, whoever can unlock your login keychain |
| **How to revoke** | *Forget now* in the settings tab, or delete the file |

On Linux, Electron's `safeStorage` falls back to a `basic_text` backend when
no Secret Service is reachable on the session bus. In that mode the key is
derived from a **hardcoded** password, so the stored token would be readable
by anyone. The plugin **refuses to operate** in that case rather than
offering false security.

What decides this is whether the keyring is reachable, not which desktop you
run: an i3 or Sway session with `gnome-keyring` running still gets the real
backend, and the plugin works normally.

### What storing the passphrase actually costs you

Without this plugin, your master passphrase never touches the disk. With it,
it is written — encrypted by the OS keychain — into `better-vault.json`, and
it becomes **recoverable at rest, while you are away, by any process running
as your user**.

That is not a flaw in the plugin; it is what delegating to `safeStorage`
means. It is starkest on Linux: GNOME Keyring enforces no per-application
access control, so any process in your session can read the entry over D-Bus
and decrypt the file offline. An independent review did exactly that on
2026-07-29 and recovered a test master passphrase without Electron or
Chromium involved. On Windows, DPAPI is scoped to your user account, which
means the same thing for anything running as you.

One smaller detail, measured rather than assumed: the stored token is
**deterministic**. Encrypting the same passphrase twice yields byte-identical
output, because Chromium's OSCrypt uses a fixed IV. That is a property of the
platform, not of this plugin, and the file is `0600` — but it does mean
anyone who can read `better-vault.json` on two dates can tell whether your
master passphrase changed, without decrypting anything.

This plugin cannot be more secure than the keychain it delegates to. The
trade-off it offers is convenience against an attacker who can already run
code in your session — weigh it deliberately.

### When the keychain is locked

A keyring that is present but **locked** blocks every `safeStorage` call —
measured, all three of them. Your system does show an authentication prompt,
and the call returns within seconds once you answer it; if nobody does, it
blocks for as long as the prompt stands. A `try/catch` is no help — a
blocking call is not an exception — and a synchronous call cannot be timed
out from the thread it is blocking.

Until 2026-07-29 the plugin probed the keychain from its module constructor,
on Tabby's startup path and **regardless of whether it was switched on**. On
a locked keyring that froze Tabby at its splash screen, and Tabby never
reached its own passphrase prompt. Found by the independent review cited
above; fixed.

What the plugin guarantees now:

- **Switched off** — it never touches the keychain, so its mere presence
  cannot delay startup at all.
- **Switched on** — the first contact with a locked keyring still blocks.
  There is no way to learn that a keychain will not answer other than asking
  it. If you are at your screen, answer your system's prompt and Tabby
  carries on. If you are not, it blocks **once**: a marker is written to disk
  before every keychain call and removed after it returns. Quit Tabby and
  start it again — the leftover marker tells the plugin to stand aside, and
  you get Tabby's own prompt as usual. **Settings → Better Vault** shows the
  suspended state and clears it on request.
- **Clearing that state really re-checks the keychain** — it encrypts and
  decrypts a throwaway value rather than just reading the backend's name.
  That can prompt you to authenticate, which is the point: a check that
  cannot fail checks nothing. Between 2026-07-29 and the fix, it only read
  the name, so it reported success on a locked keyring and the next start
  blocked again.

## Audit log

The plugin keeps a log of lifecycle events in `better-vault.log`, next to
`config.yaml`: when the vault was unlocked automatically, when a token
expired or was revoked, and when a safeguard refused to operate. Open it or
clear it from the settings tab. Retention is configurable — 30 days, 90 (the
default), a year, or unlimited.

```
[2026-08-01 11:24:00] INFO ──── session opened — machine "desktop" — plugin enabled — retention 90 d
[2026-08-01 11:24:01] INFO bridge installed — the keychain will only be queried at the first unlock
[2026-08-01 11:24:26] INFO vault unlocked from the system keychain
[2026-08-01 11:31:02] INFO manual revocation from the settings — token deleted
```

**It never contains your passphrase, nor its length** — only anonymous
lifecycle events.

**The log is always in English, whatever language the interface is in.** It
is a file you read back later, sometimes long after the fact and sometimes to
send to someone else; a line whose language depended on the locale active
when it was written would make a single file switch languages halfway
through, and would be impossible to search reliably.

Two limits worth stating plainly:

- **It is local to each machine and stays that way.** The state file is
  deliberately never synchronised, so there is no combined view across your
  machines unless you collect the files yourself.
- **It is not tamper-proof.** It is a plain text file in your own session,
  editable by anyone with access to it — which is precisely the attacker an
  audit trail would be up against. Treat it as a diagnostic and
  after-the-fact detection tool, not as evidence.

## Languages

The plugin follows the language set in Tabby — there is nothing to
configure. It ships with **English, French, Spanish and German**; under any
other locale the interface falls back to English.

Adding a language is one file in `src/i18n/`, keyed by the English source
strings, plus one line in the table at the top of `src/i18n/index.ts`. Run
`npm run lint:i18n` afterwards: it refuses an incomplete table, and catches
the mistakes this mechanism otherwise makes silently — a key that no longer
matches its source, or a `{placeholder}` lost in translation.

Contributions are welcome, including for languages already listed: these
translations were not made by native speakers.

## The Better Tabby shared settings panel

`tabby-better-vault` and [`tabby-better-sidebar`](https://github.com/TooMuhtsh/tabby-better-sidebar)
share a single settings tab, **Better Tabby**, instead of each opening its
own. Neither plugin depends on the other — installing just one still works
exactly as if the shared tab didn't exist.

The mechanism:

- Each plugin exposes its contribution under a **string token**,
  `BetterPanelContribution:<id>`, registered as an Angular provider. Nothing
  is imported between the two npm packages — the contract
  (`src/betterPanel.ts`) is duplicated verbatim in both repositories.
- The plugin with the lowest `hostWeight` becomes the **host** and renders
  the shared tab, mounting every contributor's page with `ngComponentOutlet`.
  A non-host plugin's own `SettingsTabProvider` retires via
  `getComponentType() → null`, Tabby's own mechanism for "registered, but not
  shown".
- A deep link to a specific plugin's page inside the shared tab sets
  `openRequested = true` on that plugin's own contribution object; the host
  reads and clears it on mount, whichever plugin happens to be hosting.
- **Two-level layout.** When more than one plugin is installed, the host
  renders one sub-tab per contributor inside the shared "Better Tabby" tab,
  each mounted via `ngComponentOutlet`. The host supplies an injection token,
  `BetterPanelEmbedded`, that every embedded page checks to drop its own
  outer padding — the shared tab owns the layout, an embedded page only owns
  its content. A plugin's internal sub-navigation (if it has one) stays one
  level below that, inside its own page. Installed alone, a plugin instead
  renders its page flat, with no embedding at all.

A known, accepted quirk: the non-host plugin's own settings-tab provider
stays registered (Tabby's hotkey list has no other way to enumerate tabs), so
its keyboard shortcut — e.g. "Open settings tab: Better Vault" — still
appears and still opens Settings, just without landing on any particular
tab. Harmless, and simpler than adding a second retirement path Tabby
doesn't otherwise need.
