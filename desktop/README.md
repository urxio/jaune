# Jaune for Mac

A [Tauri](https://tauri.app) shell around the deployed web app. The app does not
contain a copy of Jaune — it loads `https://jaune.space` in a WKWebView (macOS's
built-in Safari engine). **Deploying to Vercel ships to the Mac app**; there is
no separate release for UI or backend changes.

What the native layer adds, which a browser tab can't:

- Dock icon, app switcher entry, real Mac menus, Cmd+Q
- A menu-bar icon — click it for today's brief without opening a window
- **Cmd+Shift+J** from anywhere to toggle that panel
- A signable, notarizable `.app` you can hand to beta users

## Setup

Requires the Rust toolchain and Xcode Command Line Tools:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then, from this directory:

```bash
npm install
```

## Develop

A debug build points at `http://localhost:3000`, so start the Next.js dev server
in the repo root first, then:

```bash
npm run dev
```

## Build

A release build points at `https://jaune.space`.

```bash
npm run build
```

Outputs to `src-tauri/target/release/bundle/` — `macos/Jaune.app` and
`dmg/Jaune_0.1.0_aarch64.dmg`.

## How it's wired

`src-tauri/src/lib.rs` is the whole native layer:

- **`BASE_URL`** — `localhost:3000` in debug, `jaune.space` in release. Mirrors
  `devUrl` / `frontendDist` in `tauri.conf.json`.
- **`main` window** — the full app.
- **`panel` window** — the menu-bar popover, a borderless always-on-top window
  loading `/home`. Created lazily on first open and reused, so the webview stays
  warm; hides on blur like a real popover.
- **tray** — left click toggles the panel, right click opens a menu.

Icons are generated from `app/icon.svg` in the repo root. The tray icon is a
macOS *template* image (pure black + alpha), so macOS inverts it automatically
in dark menu bars.

## Known gaps

**Google sign-in will likely fail in the app.** Google blocks OAuth inside
embedded webviews (`disallowed_useragent`), and this is one. Email + password
sign-in is unaffected and works today. The fix is to detect the Tauri webview in
`app/(auth)/login/page.tsx`, open the OAuth URL in the system browser, and
return via a `jaune://` deep link (`tauri-plugin-deep-link`) — not yet done.

**Not code signed.** The build is unsigned, so Gatekeeper will block it on any
machine but this one. Before handing the `.dmg` to beta users it needs a
Developer ID certificate (requires the $99/yr Apple Developer account) plus
notarization. Per `PM_PLAYBOOK.md` that account purchase is bobo's call.

**Requires a network connection.** It loads a website; there is nothing cached
to show offline.

**No auto-update.** Shipping a new *shell* (hotkey, tray, window behavior) means
handing out a new `.dmg`. Web changes need no update at all. Add
`tauri-plugin-updater` before there are enough users for that to matter.
