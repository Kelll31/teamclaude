# TeamClaude Desktop

A desktop control panel for the local TeamClaude proxy, for Windows 10/11 x64
and Linux x64. It starts, stops and watches the proxy, shows quota and reset
times for every account, and runs the everyday account and routing commands
without a terminal. The CLI keeps working exactly as before; the desktop app
drives the same proxy and the same config.

How it is built and why: [desktop-architecture.md](desktop-architecture.md).

> Desktop builds are not official TeamClaude releases yet. Build them from
> source, or use artifacts from this repository's CI for testing only.

## Install

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `TeamClaude-Desktop-Setup-<version>.exe` | Per-user install, no administrator rights. The build is unsigned, so SmartScreen asks for confirmation. |
| Windows | `TeamClaude-Desktop-Portable-<version>.exe` | Runs without installing. |
| Linux | `TeamClaude-Desktop-<version>-x86_64.AppImage` | `chmod +x` it and run it. |
| Linux | `TeamClaude-Desktop-<version>-amd64.deb` | `sudo apt install ./TeamClaude-Desktop-*.deb` |

Node.js is not required: the app carries its own copy of the backend and runs
it with Electron's built-in Node runtime.

Uninstalling removes the app only. Your accounts and settings stay in the
TeamClaude config (`~/.config/teamclaude.json`, or `teamrouter.json`, or the
path in `TEAMCLAUDE_CONFIG`), so a reinstall picks them up again.

## First run

1. Open **Accounts** and add an account: **Sign in with Claude** (browser
   OAuth through the TeamClaude CLI), **Sign in with Codex**, **Import from
   Claude Code**, or an **Anthropic API key**. Sign-in runs the existing
   `teamclaude login` flow; tokens never pass through the app window.
2. Press **Start proxy**. The app waits until the proxy actually answers
   before it reports it as running.
3. Open **Integrations** to point Claude Code or Codex at the proxy.

If a proxy is already running — started with `teamclaude server`, by
`systemd --user`, or by another copy of the app — the desktop attaches to it
instead of starting a second one, and marks it as **external**. It will not
stop a proxy it did not start.

## Pages

| Page | What it shows and does |
| --- | --- |
| Overview | Proxy state, endpoint, backend version, account counts, current account per provider, quota bars with 5-hour and weekly reset countdowns, request count, data freshness. |
| Accounts | Accounts grouped by provider: type, token status (never the token), availability and why not, quota, next reset, priority, rotation toggle. Add, import, rename, remove (with confirmation), prefer, sign in again. |
| Sessions | Session counts, and the individual sessions when the proxy runs with `proxy.sessionDetail`, filterable by account and client. |
| Activity | Changes the app observed between status readings (switches, accounts becoming unavailable) and routing lines from the proxy's log, without request content. |
| Routing | Distribution mode, switch threshold, priorities, model routes, background probe and warm-up. Settings that can spend extra requests are off by default and carry a warning. |
| Integrations | Detects `claude` and `codex` on PATH, checks the proxy, gives copyable environment lines for bash/zsh, PowerShell and cmd, the VS Code snippet, and can open a terminal with `ANTHROPIC_BASE_URL` set. |
| Settings | Theme (dark, light, system), language (English, Русский, 日本語), tray and startup behaviour, notifications, the config directory, diagnostics. |
| Logs | The managed proxy's stdout/stderr and the app's own notes, sanitized; filter, search, auto-scroll, clear, the backend crash log, and **Export diagnostics**. |
| About | Desktop, bundled backend and running backend versions, links, manual update check. |

Quota numbers come only from what the backend has seen. When there is no
reading yet the app says **Unknown**, never a guess. A per-minute rate limit
is shown as such and is not counted as an exhausted quota.

## Background mode and tray

- **Minimize to tray** and **Keep proxy running when the window closes** are
  on by default: closing the window hides it, and the proxy keeps serving.
- **Quit** (tray menu) stops the proxy only if this app started it.
- **Launch at login** (off by default) uses the per-user Run key on Windows
  and `~/.config/autostart/teamclaude-desktop.desktop` on Linux. Nothing is
  installed system-wide.
- **Start proxy when the app launches**, **Start minimized** and **Restart
  the proxy after a crash** are off by default. Automatic restart gives up
  after four crashes within five minutes.
- On Linux, if TeamClaude is installed as a `systemd --user` service
  (`teamclaude service install`), the app attaches to that service; stop it
  with `systemctl --user stop teamclaude`.
- If the Linux desktop has no system tray (some Wayland sessions), the app
  still works; closing the window quits it.

## Notifications

Local system notifications for: proxy crashed, account authentication
expired, all eligible accounts unavailable, quota exhausted, backend
recovered, update available. Each type can be turned off in Settings. They
are derived from the status the app already polls; no extra request is made
for them, and they never contain a credential.

## Diagnostics

**Export diagnostics** (Settings or Logs) writes a Markdown report with the
OS, versions, proxy state, a numbered account summary (no names or emails)
and the last 200 log lines. Tokens, API keys, auth headers, cookies, URL
passwords and OAuth codes are redacted, and the config file is never
included. Read it before attaching it to an issue.

## Build from source

Requires Node.js 20+ and npm. From the repository root:

```bash
cd desktop && npm ci && npm run dev
```

`npm run dev` builds the app and runs it against the repository's own
backend (`../src`). Checks:

```bash
npm run typecheck && npm run lint && npm test
```

`npm test` runs the unit tests and an integration test that starts the real
backend from `../src` with placeholder accounts and an upstream that never
answers; no credentials are used.

Packaging, on the target platform:

```bash
npm run dist:win
```

```bash
npm run dist:linux
```

Artifacts land in `desktop/dist/`. `node scripts/check-dist.mjs win` (or
`linux`) checks that the expected files exist and that nothing in the package
carries a credential or a config file. The Linux `.deb` needs `fakeroot` and
`dpkg`.

## Manual test checklist

The automated checks cannot click through a real desktop session. Before a
release, or when a change touches the area, run these by hand on Windows 10/11
x64 and on one Linux x64 desktop (note X11 or Wayland and the desktop
environment). Use your own accounts; never paste their names or tokens into
an issue.

| Area | Steps | Expected |
| --- | --- | --- |
| Clean install | Install the NSIS package (Windows) or the `.deb`/AppImage (Linux) on a machine without Node.js | The app starts; About shows the bundled backend version |
| Existing data | Install on a machine that already has a TeamClaude config and accounts | The accounts appear unchanged; the app does not rewrite the config file |
| Attach | Start `teamclaude` in a terminal, then the app | Phase *running*, ownership *external*; Stop is not offered |
| Own backend | With no proxy running, press Start | Phase *starting* then *running*; Quit from the tray stops it |
| Port conflict | Occupy the configured port with another program, press Start | *Port conflict* is shown; the other program keeps running |
| Sign in | Accounts → add a Claude account, finish the browser sign-in | The job ends successfully and the account appears without a restart |
| API key | Add an API-key account | The key is not shown in the job output or in Logs |
| Account controls | Switch, disable/enable, change priority | The change shows within one poll and in `teamclaude status` |
| Routing | Change the threshold and distribution mode | Values persist after an app restart |
| Tray | Close the window, use the tray menu | The proxy keeps serving; Open and Quit work |
| No tray (Wayland without StatusNotifier) | Close the window | The app quits instead of hiding |
| Launch at login | Turn it on, sign out and in | The app starts (minimized if that is set) |
| Crash | Kill the owned backend process | A crash notification with the exit code; with restart on, it comes back |
| Notifications | Let an account's sign-in expire or exhaust a window | One notification per event, no credential in its text |
| Diagnostics | Export diagnostics | The report numbers accounts and contains no token, key or email |
| Uninstall | Uninstall the app | The TeamClaude config and accounts remain |

Record which rows passed, on what OS and version, in the pull request; rows
not run are listed as not verified.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| "Port conflict" | Something that is not TeamClaude listens on the configured port. Change `proxy.port` in the config or stop that program; the app will not touch it. |
| "The proxy asks for an API key" | `proxy.apiKey` is set but the app could not read it from the config. Check the config path shown in Settings. |
| Start fails with "no accounts" | The proxy refuses to start with an empty pool. Add an account first. |
| The proxy keeps crashing | See Logs and the crash log there. Automatic restart stops after repeated crashes so the error stays visible. |
| "Backend is older than this app supports" | Update the TeamClaude you run in the terminal, or stop it and let the desktop start its bundled backend. |
