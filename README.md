# tabby-better-vault

**English** · [Français](README.fr.md)

Unlock the [Tabby](https://tabby.sh) vault automatically using your operating
system's own keychain — no third-party password manager required.

Tabby's vault protects your saved passwords and private keys behind a master
passphrase. If you also enable configuration encryption, that passphrase is
asked for **on every single launch**. This plugin hands the passphrase to the
OS keychain once, then answers on your behalf.

> **Status: working, but not yet on npm.** Install from source (see below).
> This plugin relies on an undocumented part of Tabby — see
> [How it works](#how-it-works).

## Features

- [x] **Automatic unlock** through the OS keychain — Windows Credential
      Manager (DPAPI), macOS Keychain, Linux Secret Service
- [x] **Works with encrypted configuration**, the case where the prompt would
      otherwise appear on every start
- [x] **Configurable expiry** — a fixed weekly slot (default: Monday 3 AM), a
      sliding delay, or never
- [x] **Per-machine settings** — enable it on your desktop, leave it off on a
      laptop; each machine keeps its own policy
- [x] **Revoke at any time** from the settings tab
- [x] **Notification when your passphrase is stored**, stating where it went,
      until when, and how to revoke it
- [x] **Audit log** of vault openings, expiries and revocations, with
      configurable retention — never containing the passphrase
- [x] **Observation mode** — see what the plugin would do without letting it
      store anything
- [x] **Safe fallback** — any failure quietly returns you to Tabby's own
      prompt; the plugin never blocks access to your vault
- [ ] Published on npm, installable from Tabby's plugin manager
- [x] Verified on Linux, including refusing the insecure `basic_text` backend
- [ ] Shared settings panel with other `tabby-better-*` plugins

## Installation

Not published yet, so build it from source:

```bash
git clone https://github.com/TooMuhtsh/tabby-better-vault
cd tabby-better-vault
npm install --ignore-scripts
npm run build
```

Then, with Tabby closed, link the folder into Tabby's plugin directory:

```powershell
# Windows — do not use the TABBY_PLUGINS variable, it is broken (see below)
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-vault" -Target "<path-to-this-folder>"
```

```bash
# macOS / Linux
ln -s "<path-to-this-folder>" ~/.config/tabby/plugins/node_modules/tabby-better-vault
```

Restart Tabby completely — reloading the window is not enough.

## Usage

Open **Settings → Better Vault** and turn on *Enable on this machine*.

The next time Tabby asks for your master passphrase, type it as usual: that
one is captured and handed to your OS keychain. From then on, the vault opens
on its own until the passphrase expires or you revoke it.

## Audit log

The plugin keeps a log of lifecycle events in `better-vault.log`, next to
`config.yaml`: when the vault was unlocked automatically, when a token expired
or was revoked, and when a safeguard refused to operate. Open it or clear it
from the settings tab. Retention is configurable — 30 days, 90 (the default),
a year, or unlimited.

```
[2026-07-28 23:19:20] INFO ──── session opened — machine "desktop" — plugin active — retention 90 d
[2026-07-28 23:19:21] INFO  vault unlocked from the system keychain
[2026-07-28 23:20:39] INFO  manual revocation from settings — token deleted
```

**It never contains your passphrase, nor its length** — only anonymous
lifecycle events.

Two limits worth stating plainly:

- **It is local to each machine and stays that way.** The state file is
  deliberately never synchronised, so there is no combined view across your
  machines unless you collect the files yourself.
- **It is not tamper-proof.** It is a plain text file in your own session,
  editable by anyone with access to it — which is precisely the attacker an
  audit trail would be up against. Treat it as a diagnostic and after-the-fact
  detection tool, not as evidence.

## How it works

**Tabby exposes no API to inject the master passphrase.** Its cache is a
module-scoped variable, deliberately kept out of reach of `VaultService`
fields. The only workable approach is to replace `getPassphrase` on the
service instance obtained from the shared Angular injector — the same approach
[tabby-vault-keepassxc](https://github.com/chomoe327/tabby-vault-keepassxc)
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
  machine-specific token stored there would make two machines wipe each other's
  token in a loop. Keeping it separate also means each machine naturally has
  its own settings.
- **The plaintext passphrase never outlives a call.** It is never cached, never
  written to a field, never logged — not even its length.

## Security

| | |
|---|---|
| **What is stored** | Your vault master passphrase, encrypted by the OS keychain |
| **Where** | `better-vault.json` in Tabby's config directory, alongside `config.yaml` |
| **Who can read it** | On Windows, only your user account on this machine (DPAPI is user-scoped); on macOS, whoever can unlock your login keychain |
| **How to revoke** | *Forget now* in the settings tab, or delete the file |

On Linux, Electron's `safeStorage` falls back to a `basic_text` backend when
no Secret Service is reachable on the session bus. In that mode the key is
derived from a **hardcoded** password, so the stored token would be readable by
anyone. The plugin **refuses to operate** in that case rather than offering
false security.

What decides this is whether the keyring is reachable, not which desktop you
run: an i3 or Sway session with `gnome-keyring` running still gets the real
backend, and the plugin works normally.

This plugin cannot be more secure than the keychain it delegates to. If your
threat model includes an attacker with access to your unlocked user session,
storing the passphrase at all is a trade-off you should weigh.

## Roadmap

Short term: npm publication and a shared settings panel
grouping every installed `tabby-better-*` plugin under a single tab.

The full roadmap, along with the project's technical notes and the pitfalls
found along the way, lives in [`.AIRules/`](.AIRules/README.html) — open those
files in a browser.

## Related

[**tabby-better-sidebar**](https://github.com/TooMuhtsh/tabby-better-sidebar) —
an enhanced connection sidebar for Tabby: pinned favourites, live connection
status, drag & drop, custom icon picker. Sibling project, independent: neither
plugin requires the other.

## Credits

- [Tabby](https://github.com/Eugeny/tabby) by Eugeny — the terminal this plugin
  extends
- [tabby-vault-keepassxc](https://github.com/chomoe327/tabby-vault-keepassxc) —
  prior art for automatic vault unlocking, and independent confirmation that
  patching `getPassphrase` is the only viable route
- [ngx-toastr](https://github.com/scttcper/ngx-toastr) and
  [js-yaml](https://github.com/nodeca/js-yaml)

## License

MIT — see [LICENSE](LICENSE).
