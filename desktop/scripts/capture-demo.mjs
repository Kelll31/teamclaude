// Records docs/assets/desktop-demo.gif from the built app (`npm run build`
// first). The window never appears on a monitor: it starts minimized, is then
// shown off every screen without focus, and frames come from the renderer over
// CDP. Placeholder API-key accounts, an upstream on port 1 that never listens
// and quota readings seeded through the backend's own state file, so nothing
// leaves the machine and no real account appears. Notifications are off.
// Needs ffmpeg on PATH.
//
//   node scripts/capture-demo.mjs [out.gif]

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { _electron } from 'playwright-core';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? join(desktop, '..', 'docs', 'assets', 'desktop-demo.gif'));
const WIDTH = 1280;
const HEIGHT = 800;
/** Seconds each page stays on screen in the GIF. */
const HOLD = 2.6;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Page shortcut (sidebar order) and what to do before the frame is taken.
 * Integrations and Settings stay out: one prints this machine's paths, the
 * other this script's settings rather than the app's defaults.
 */
const SHOTS = [
  { key: 'Control+1', name: 'overview' },
  { key: 'Control+2', name: 'accounts' },
  { key: 'Control+2', name: 'accounts-cards', scroll: 520 },
  { key: 'Control+5', name: 'routing' },
];

function freePort() {
  return new Promise((done, fail) => {
    const server = http.createServer();
    server.on('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

/** One account's saved quota, as exportQuotaState writes it. */
function saved(name, now, { fiveHour, weekly, fiveHourResetIn, weeklyResetIn, weeklySeenAgo = 2 * MIN }) {
  return {
    name,
    provider: 'anthropic',
    profile: {},
    quota: {
      unified5h: fiveHour,
      unified5hReset: now + fiveHourResetIn,
      unified5hSeenAt: now - 2 * MIN,
      unified7d: weekly,
      unified7dReset: now + weeklyResetIn,
      unified7dSeenAt: now - weeklySeenAgo,
    },
  };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'tc-desktop-demo-'));
  try {
    const port = await freePort();
    const now = Date.now();
    const configPath = join(dir, 'teamclaude.json');
    const accounts = ['work@example.com', 'personal@example.com', 'backup@example.com'];
    writeFileSync(configPath, JSON.stringify({
      proxy: { host: '127.0.0.1', port },
      upstream: 'http://127.0.0.1:1',
      accounts: accounts.map((name, i) => ({ name, type: 'apikey', apiKey: `demo-key-not-real-${i}`, priority: i === 2 ? 1 : 0 })),
    }, null, 2));
    writeFileSync(join(dir, 'teamclaude.state.json'), JSON.stringify({
      quota: [
        saved(accounts[0], now, { fiveHour: 0.62, weekly: 0.41, fiveHourResetIn: 2 * HOUR + 14 * MIN, weeklyResetIn: 3 * DAY + 5 * HOUR }),
        saved(accounts[1], now, { fiveHour: 0.18, weekly: 0.73, fiveHourResetIn: 4 * HOUR + 2 * MIN, weeklyResetIn: 1 * DAY + 9 * HOUR }),
        // An idle account whose weekly reading is days old: drawn as a floor.
        saved(accounts[2], now, { fiveHour: 0.05, weekly: 0.2, fiveHourResetIn: 3 * HOUR, weeklyResetIn: 5 * DAY, weeklySeenAgo: 2 * DAY }),
      ],
    }));

    const userData = join(dir, 'user-data');
    mkdirSync(userData);
    const off = { proxyCrashed: false, authExpired: false, allUnavailable: false, quotaExhausted: false, backendRecovered: false, updateAvailable: false };
    writeFileSync(join(userData, 'settings.json'), JSON.stringify({
      language: 'en', theme: 'dark', startMinimized: true, startProxyOnLaunch: true, notifications: off,
    }));

    // An occluded window stops painting; this one sits off every monitor.
    const args = [desktop, `--user-data-dir=${userData}`, '--disable-features=CalculateNativeWinOcclusion'];
    if (process.platform === 'linux') args.push('--no-sandbox');
    const app = await _electron.launch({
      executablePath: electronPath,
      args,
      env: { ...process.env, TEAMCLAUDE_CONFIG: configPath, TEAMROUTER_CONFIG: configPath, TEAMCLAUDE_DISABLE_AUTOUPDATE: '1' },
    });
    try {
      const page = await app.firstWindow();
      // A hidden window does not paint, so it is shown where no screen is:
      // off every monitor, without focus or a taskbar button.
      await app.evaluate(({ BrowserWindow }, size) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setSkipTaskbar(true);
        win.webContents.setBackgroundThrottling(false);
        win.setBounds({ x: -20000, y: -20000, width: size.width, height: size.height });
        win.showInactive();
        win.setBounds({ x: -20000, y: -20000, width: size.width, height: size.height });
      }, { width: WIDTH, height: HEIGHT });
      // Wait until the managed proxy answers and its accounts are drawn.
      await page.getByText('work@example.com').first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);

      const frames = join(dir, 'frames');
      mkdirSync(frames);
      for (const [i, shot] of SHOTS.entries()) {
        await page.keyboard.press(shot.key);
        await page.waitForTimeout(700);
        await page.evaluate(y => { (globalThis.document.querySelector('main') ?? globalThis.document.scrollingElement)?.scrollTo(0, y); }, shot.scroll ?? 0);
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(frames, `${String(i).padStart(2, '0')}.png`) });
        process.stdout.write(`frame ${i}: ${shot.name}\n`);
      }

      // A palette pass keeps the dark UI's flat colours exact and the file small.
      const input = ['-y', '-framerate', `1/${HOLD}`, '-i', join(frames, '%02d.png')];
      const scale = 'fps=10,scale=960:-1:flags=lanczos';
      const palette = join(dir, 'palette.png');
      execFileSync('ffmpeg', [...input, '-vf', `${scale},palettegen=stats_mode=diff`, palette], { stdio: 'ignore' });
      mkdirSync(dirname(out), { recursive: true });
      execFileSync('ffmpeg', [...input, '-i', palette, '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=none`, '-loop', '0', out], { stdio: 'ignore' });
      process.stdout.write(`wrote ${out}\n`);
    } finally {
      await app.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
