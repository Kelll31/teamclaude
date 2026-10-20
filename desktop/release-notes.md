> **Unofficial build.** TeamClaude Desktop {{VERSION}} is built and published by the
> [Kelll31/teamclaude](https://github.com/Kelll31/teamclaude) fork. It is **not** a
> TeamClaude release and is not supported by the TeamClaude maintainers
> ([KarpelesLab/teamclaude](https://github.com/KarpelesLab/teamclaude)). The builds are
> **not code-signed**: Windows SmartScreen warns before the first install
> (More info → Run anyway). Check the SHA-256 sums below.

A desktop control panel for a local TeamClaude proxy. It bundles the backend, so
Node.js is not needed. Accounts, routing and the config stay in TeamClaude; the
app holds no credentials.

| File | For |
| --- | --- |
| `TeamClaude-Desktop-Setup-{{VERSION}}.exe` | Windows 10/11 x64, installer — **updates itself** |
| `TeamClaude-Desktop-Portable-{{VERSION}}.exe` | Windows, no install — update by downloading again |
| `TeamClaude-Desktop-{{VERSION}}-x86_64.AppImage` | Linux x64 — **updates itself** |
| `TeamClaude-Desktop-{{VERSION}}-amd64.deb` | Debian/Ubuntu x64 — update by installing the new package |

Self-updating copies check this repository's releases a minute after launch
and every 6 hours, download in the background and install when the app quits
(Settings → App updates). `latest.yml` and `latest-linux.yml` are the update
feed.
