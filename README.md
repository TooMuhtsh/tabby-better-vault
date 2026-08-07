<div align="center">

# 🔐 tabby-better-vault

**Automatic vault unlock for [Tabby](https://tabby.sh)** — your OS keychain
remembers your master passphrase, so Tabby stops asking for it.

**English** · [Français](README.fr.md)

[![License: MIT](https://img.shields.io/github/license/TooMuhtsh/tabby-better-vault?color=0d9488)](LICENSE)
[![Part of Better Tabby](https://img.shields.io/badge/part%20of-Better%20Tabby-0d9488)](#-better-tabby-the-plugin-family)
[![Verified on](https://img.shields.io/badge/verified%20on-Windows%20%26%20Linux-0d9488)](docs/ARCHITECTURE.md#security)

</div>

---

Tabby's vault protects your saved passwords and private keys behind a master
passphrase. If you also enable configuration encryption, that passphrase is
asked for **on every single launch**. This plugin hands it to your OS
keychain once — Windows Credential Manager, macOS Keychain, or Linux Secret
Service — and answers on your behalf from then on.

> **Note:** this plugin relies on an undocumented part of Tabby; see
> [how it works](docs/ARCHITECTURE.md#how-it-works).

## 🧩 Better Tabby, the plugin family

<img src="docs/img/better-tabby-panel.svg" alt="One shared &quot;Better Tabby&quot; settings tab in Tabby, hosting the Vault page and the Sidebar page side by side" width="100%">

This plugin is one half of **Better Tabby**, a small family of independent
plugins that happen to share one settings tab instead of scattering three:

| | Plugin | Adds |
|---|---|---|
| 🔐 | **tabby-better-vault** *(this repo)* | Automatic vault unlock via your OS keychain |
| 📁 | **[tabby-better-sidebar](https://github.com/TooMuhtsh/tabby-better-sidebar)** | Pinned favourites, live connection status, drag & drop, contextual SFTP browser |

**Neither plugin requires the other.** Install just this one and it behaves
exactly as if the other didn't exist — its own settings tab, nothing shared.
Install both, and they elect one of themselves to host a single **Better
Tabby** tab, each still rendering its own page inside it. No npm dependency
between the two repos, no shared code: just a small string contract
(`BetterPanelContribution:<id>`) each plugin recognises independently. Detail
in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#the-better-tabby-shared-settings-panel).

## ✨ Features

- 🔑 **Automatic unlock** through the OS keychain — Windows Credential
  Manager (DPAPI), macOS Keychain, Linux Secret Service
- 🔒 **Works with encrypted configuration**, the case where the prompt would
  otherwise appear on every start
- ⏱️ **Configurable expiry** — a fixed weekly slot, a sliding delay, or never
- 💻 **Per-machine settings** — enable it on your desktop, leave it off on a
  laptop
- 🚫 **Per-profile exclusions** — keep automatic unlocking for most SSH
  profiles, get Tabby's own prompt for the ones you exclude; a group acts as
  a one-click shortcut over its members
- ✋ **Revoke at any time** from the settings tab, with a notification stating
  where the passphrase went and how to revoke it
- 📜 **Audit log** of vault openings, expiries and revocations — never
  containing the passphrase
- 👀 **Observation mode** — see what the plugin would do without letting it
  store anything
- 🌍 **Follows Tabby's language** — English, French, Spanish, German
- 🛟 **Safe fallback** — any failure quietly returns you to Tabby's own
  prompt; switched off, it never touches the keychain at all
- ✅ **Verified on Windows and Linux**, including an independent adversarial
  review on Linux that found and fixed real defects. **macOS is
  best-effort** — same `safeStorage` API, but not independently measured.

Full technical detail — how the keychain integration actually works, what it
costs you security-wise, the audit log format, per-platform notes — lives in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 📦 Installation

In Tabby, open **Settings → Plugins**, search for `better-vault` and install
it, then restart Tabby completely.

<details>
<summary>With npm directly</summary>

```bash
# In Tabby's plugin directory: %APPDATA%\tabby\plugins on Windows,
# ~/.config/tabby/plugins on macOS/Linux
npm install tabby-better-vault
```

Then restart Tabby completely.

</details>

<details>
<summary>From source (for development)</summary>

```bash
git clone https://github.com/TooMuhtsh/tabby-better-vault
cd tabby-better-vault
npm install --ignore-scripts
npm run build
```

Then, with Tabby closed, link the folder into Tabby's plugin directory:

```powershell
# Windows — do not use the TABBY_PLUGINS variable, it is broken
New-Item -ItemType Junction -Path "$env:APPDATA\tabby\plugins\node_modules\tabby-better-vault" -Target "<path-to-this-folder>"
```

```bash
# macOS / Linux
ln -s "<path-to-this-folder>" ~/.config/tabby/plugins/node_modules/tabby-better-vault
```

Restart Tabby completely — reloading the window is not enough.

</details>

## 🚀 Usage

Open **Settings → Better Vault** (or **Better Tabby → 🔐 Vault** if
`tabby-better-sidebar` is also installed) and turn on *Enable on this
machine*.

The next time Tabby asks for your master passphrase, type it as usual: that
one is captured and handed to your OS keychain. From then on, the vault opens
on its own until the passphrase expires or you revoke it.

Want one profile to keep asking? The **Excluded profiles** tab of the same
page lists your SSH profiles by group: an excluded profile gets Tabby's own
passphrase prompt at every connection, everything else keeps unlocking
automatically. Excluding a group is a one-click shortcut applied to its
current members. What this does — and deliberately does not — protect is
stated plainly in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#per-profile-exclusions).

## 🔒 Security, in short

This plugin cannot be more secure than the keychain it delegates to, and
storing the passphrase at all — even encrypted — is a real trade-off, not a
free lunch. It refuses to operate on Linux backends that offer no real
protection, and never lets a locked keychain block Tabby's own startup. The
full picture, including what an attacker who already has code execution in
your session gains, is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#security).

## Related

[**tabby-better-sidebar**](https://github.com/TooMuhtsh/tabby-better-sidebar) —
the sibling plugin, see [Better Tabby](#-better-tabby-the-plugin-family)
above.

## Credits

- [Tabby](https://github.com/Eugeny/tabby) by Eugeny — the terminal this
  plugin extends
- [tabby-vault-keepassxc](https://github.com/chomoe327/tabby-vault-keepassxc) —
  prior art for automatic vault unlocking, and independent confirmation that
  patching `getPassphrase` is the only viable route
- [ngx-toastr](https://github.com/scttcper/ngx-toastr) and
  [js-yaml](https://github.com/nodeca/js-yaml)

## License

MIT — see [LICENSE](LICENSE).
