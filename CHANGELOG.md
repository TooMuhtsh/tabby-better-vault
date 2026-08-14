# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(patch = fix, minor = addition).

## [Unreleased]

## [1.0.2] — 2026-08-14

### Added

- `THIRD-PARTY-NOTICES.md` shipped in the published npm package.
- This changelog.

### Changed

- Notification colors now follow severity: informational messages (password
  saved, vault unlocked) are blue — red is reserved for warnings.
- All notifications are prefixed with the plugin name, so it is clear who is
  talking.
- The unlock notice anchors to the focused pane of a split view, not the whole
  tab; when no tab exists yet, it falls back to a window toast after 3 seconds
  instead of silently giving up.

### Fixed

- Production builds no longer ship `dist/index.js.map` in the npm tarball
  (source maps stripped).

## [1.0.1] — 2026-08-10

### Changed

- npm keywords expanded from 1 (`tabby-plugin`) to 15 for discoverability in
  npm and Tabby's in-app plugin search. No code changes.

## [1.0.0] — 2026-08-07

First stable release.

### Added

- Automatic Tabby vault unlock through the OS keychain — Windows Credential
  Manager (DPAPI), macOS Keychain, Linux Secret Service — so the master
  passphrase prompt stops appearing on every launch when configuration
  encryption is enabled.
- Configurable expiry: a fixed weekly slot, a sliding delay, or never.
- Per-machine settings and per-profile SSH exclusions, with group shortcuts;
  excluded profiles get Tabby's own passphrase prompt.
- Settings tab with revocation at any time, and an observation mode to see
  what the plugin would do without letting it store anything.
- Audit log of vault openings, expiries and revocations — never containing
  the passphrase.
- Follows Tabby's language: English, French, Spanish, German.
- Safe fallback: any failure quietly returns to Tabby's own prompt; switched
  off, the plugin never touches the keychain at all.

Verified on Windows and Linux, including an independent adversarial review on
Linux. macOS is best-effort — same `safeStorage` API, but not independently
measured.

[Unreleased]: https://github.com/TooMuhtsh/tabby-better-vault/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/TooMuhtsh/tabby-better-vault/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/TooMuhtsh/tabby-better-vault/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/TooMuhtsh/tabby-better-vault/releases/tag/v1.0.0
