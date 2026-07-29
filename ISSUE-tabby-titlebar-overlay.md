# Windows: native window controls overlap the tab bar when config encryption is enabled

## Summary

On Windows, enabling **config encryption** (`encrypted: true`) while
`appearance.frame` is set to `native` leaves the window in a state where the
native Windows caption buttons (minimize / maximize / close) are painted **on
top of** Tabby's own tab bar, and the window can no longer be dragged by its
top strip.

The root cause is a disagreement between the two processes about the value of
`appearance.frame`: the **main process reads `config.yaml` before any
decryption happens**, so every setting inside the encrypted blob silently falls
back to its default there, while the **renderer** — which runs after the vault
has been unlocked — sees the real value.

## Environment

| | |
|---|---|
| Tabby | 1.0.235 |
| Electron | 38.8.6 (Chromium 140.0.7339.249, Node 22.22.0) |
| OS | Windows 11 Pro 26200 |
| `appearance.frame` | `native` |
| `appearance.tabsLocation` | `top` |
| `encrypted` | `true` |

## Steps to reproduce

1. On Windows, set **Appearance → Frame** to `Native`.
2. Enable config encryption (Settings → Vault → encrypt config).
3. Restart Tabby.

## Actual behaviour

- The native caption buttons overlap the right-hand end of the tab bar. Any
  toolbar button there (the settings gear, an update button, plugin-contributed
  buttons) sits underneath them and is unclickable.
- With enough tabs open, tab headers slide under the buttons too.
- The window cannot be dragged by the top strip: there is no OS title bar and
  no drag region either.

## Expected behaviour

Either a real native frame (as `frame: native` requests), or the 138 px
`window-controls-spacer` that Tabby already renders for the overlay case.

## Cause

**Main process** — window creation, compiled into `resources/app.asar`
(`app/lib/window.ts` in the repo):

```js
"native" === this.configStore.appearance?.frame
    ? o.frame = true
    : (o.titleBarStyle = "hidden",
       "win32" === process.platform && (o.titleBarOverlay = { color: "#00000000" }))
```

When the config is encrypted, `config.yaml` only keeps `vault`, `encrypted` and
`configSync` in plaintext — everything else, `appearance` included, is inside
the encrypted blob. The main process has no passphrase at this point, so
`this.configStore.appearance` is `undefined`, `appearance?.frame` is
`undefined`, and the `else` branch runs: `titleBarStyle: "hidden"` plus
`titleBarOverlay`. The caption buttons are therefore composited by the OS
**over** the web contents.

**Renderer** — `tabby-core/src/components/appRoot.component.pug`, lines 99–108:

```pug
window-controls.background(
  *ngIf='config.store.appearance.frame == "thin" && ... && hostApp.platform == Platform.Linux',
)

div.window-controls-spacer(
  *ngIf='config.store.appearance.frame == "thin" && (hostApp.platform == Platform.Windows) && (config.store.appearance.tabsLocation == "top")',
)
```

By the time the renderer builds the tab bar the vault is unlocked, so it reads
the real `frame: native`. It therefore renders no `title-bar`, no
`window-controls` and — critically — no `window-controls-spacer`, because it
believes the OS is drawing a real frame outside the web contents. `.btn-space`
also loses its `.persistent` and `.drag` classes, which is what removes the
drag region.

Nobody reserves the space, so the two views collide.

## Measurements

Read live over the Chrome DevTools Protocol, window 2048 CSS px wide.

**`frame: native` + `encrypted: true` (broken):**

```
navigator.windowControlsOverlay.visible = true
titlebarAreaRect                        = x=0 y=0 w=1911 h=23   -> controls occupy x=1911..2048

.tab-bar children:
  [0] div.tabs                 x=304  w=428
  [1] div.btn-group            x=732  w=92
  [2] div.btn-space            x=824  w=1178    (no .persistent, no .drag, app-region: none)
  [3] div.btn-group            x=2002 w=46      <-- underneath the caption buttons
  (no window-controls-spacer)
```

**`frame: thin` (fixed), same encrypted config** — the overlay is still enabled,
because the main process still cannot read `appearance`; the difference is that
the renderer now reserves the space for it:

```
navigator.windowControlsOverlay.visible = true
titlebarAreaRect                        = x=0 y=0 w=1911 h=32   -> controls still occupy x=1911..2048

.tab-bar children:
  [0] div.tabs                        x=304  w=428
  [1] div.btn-group                   x=732  w=92
  [2] div.btn-space.persistent.drag   x=824  w=1040   (app-region: drag)
  [3] div.btn-group                   x=1864 w=46     <-- stops before 1911
  [4] div.window-controls-spacer      x=1910 w=138    <-- covers the overlay region
```

For reference, `frame: native` with the config **decrypted** gives
`windowControlsOverlay.visible = false` and a `app-root` 22 px shorter — the
real OS title bar, as intended.

## Suggested fixes

1. **Keep `appearance.frame` out of the encrypted blob**, alongside `vault`,
   `encrypted` and `configSync`. It is not sensitive, and it is consumed by the
   main process at window-creation time. This fixes the root cause.
2. Or **do not enable `titleBarOverlay` when the config is encrypted and
   therefore unreadable** — i.e. treat "`appearance` is `undefined` *and*
   `encrypted` is true" as "unknown", and pick the frame mode that degrades
   safest rather than falling through to the overlay branch.
3. Or, as a renderer-side safety net, render `window-controls-spacer` whenever
   `navigator.windowControlsOverlay.visible` is true, regardless of what
   `appearance.frame` says. That would keep the two processes from ever
   disagreeing about whether space must be reserved.

More generally: **any setting the main process reads at window-creation time
silently falls back to its default when config encryption is on.**
`appearance.frame` is the instance that produced a visible bug, but the class
of problem is wider and may be worth auditing.

## Workaround

Set `appearance.frame` to `thin`. It is the only self-consistent value under
config encryption: the main process cannot read it either way and always
enables the overlay, and `thin` is exactly the value that makes the renderer
reserve the space and restore the drag region.
