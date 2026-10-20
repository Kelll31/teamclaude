// The built app end to end: Electron main process, renderer, IPC and the real
// backend from ../src. Placeholder API-key accounts and an upstream on port 1,
// which never listens, so nothing leaves the machine and no real account is
// touched. Every effect is checked against the backend's own status endpoint,
// not only against what the window shows.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import electronPath from 'electron';
import { _electron, type ElectronApplication, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const desktop = resolve(__dirname, '..', '..');
const FAKE_KEY = 'test-key-not-real';

let dir: string;
let port: number;
let app: ElectronApplication;
let page: Page;

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = http.createServer();
    server.on('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port: p } = server.address() as AddressInfo;
      server.close(() => done(p));
    });
  });
}

async function status(): Promise<{ accounts: Array<{ name: string; disabled: boolean }>; switchThreshold: number }> {
  const res = await fetch(`http://127.0.0.1:${port}/teamclaude/status`);
  return res.json() as Promise<{ accounts: Array<{ name: string; disabled: boolean }>; switchThreshold: number }>;
}

/** Polls the backend until `check` holds; the UI acts through it, so this is the real outcome. */
async function eventually<T>(read: () => Promise<T>, check: (value: T) => boolean): Promise<T> {
  for (;;) {
    const value = await read().catch(() => null);
    if (value !== null && check(value)) return value;
    await new Promise(r => setTimeout(r, 250));
  }
}

const nav = (name: string) => page.getByRole('button', { name, exact: true }).first().click();

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tc-desktop-e2e-'));
  port = await freePort();
  const configPath = join(dir, 'teamclaude.json');
  writeFileSync(configPath, JSON.stringify({
    proxy: { host: '127.0.0.1', port },
    upstream: 'http://127.0.0.1:1',
    accounts: [
      { name: 'placeholder-a', type: 'apikey', apiKey: `${FAKE_KEY}-aaaa` },
      { name: 'placeholder-b', type: 'apikey', apiKey: `${FAKE_KEY}-bbbb`, priority: 1 },
    ],
  }, null, 2));
  const userData = join(dir, 'user-data');
  mkdirSync(userData);
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: 'en' }));

  const args = [desktop, `--user-data-dir=${userData}`];
  if (process.platform === 'linux') args.push('--no-sandbox');
  app = await _electron.launch({
    executablePath: electronPath as unknown as string,
    args,
    env: { ...process.env, TEAMCLAUDE_CONFIG: configPath, TEAMROUTER_CONFIG: configPath, TEAMCLAUDE_DISABLE_AUTOUPDATE: '1' },
  });
  page = await app.firstWindow();
  await page.getByRole('button', { name: 'Overview', exact: true }).first().waitFor();
});

afterAll(async () => {
  await app?.close().catch(() => {});
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
});

describe('TeamClaude Desktop', () => {
  it('renders with no Node APIs in the page', async () => {
    expect(await page.title()).toBe('TeamClaude Desktop');
    expect(await page.evaluate(() => [typeof (globalThis as { require?: unknown }).require, typeof (globalThis as { process?: unknown }).process])).toEqual(['undefined', 'undefined']);
  });

  it('starts the bundled backend from the Overview page', async () => {
    await nav('Overview');
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    const s = await eventually(status, v => v.accounts.length === 2);
    expect(s.accounts.map(a => a.name).sort()).toEqual(['placeholder-a', 'placeholder-b']);
    await page.getByText('Running').first().waitFor();
  });

  it('takes an account out of rotation from the Accounts page', async () => {
    await nav('Accounts');
    const card = page.getByRole('heading', { name: 'placeholder-b', exact: true }).locator('xpath=ancestor::*[.//input[@role="switch"]][1]');
    // A controlled switch: it flips once the backend has answered, so the
    // outcome is read from the backend, not from the click.
    await card.getByRole('switch').first().click({ force: true });
    const s = await eventually(status, v => v.accounts.find(a => a.name === 'placeholder-b')?.disabled === true);
    expect(s.accounts.find(a => a.name === 'placeholder-a')?.disabled).toBe(false);
  });

  it('sets the switch threshold from the Routing page', async () => {
    await nav('Routing');
    const field = page.getByLabel('Percent (1–100)');
    await field.fill('80');
    await field.locator('xpath=ancestor::form[1]').getByRole('button', { name: 'Apply', exact: true }).click();
    await eventually(status, v => Math.abs(v.switchThreshold - 0.8) < 1e-9);
  });

  it('keeps the activity timeline across a window reload', async () => {
    await nav('Activity');
    const entry = page.getByText(/"placeholder-b":/).first();
    await entry.waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor();
    await nav('Activity');
    await page.getByText(/"placeholder-b":/).first().waitFor();
  });

  it('exports diagnostics without names or keys', async () => {
    const report = join(dir, 'diagnostics.md');
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as typeof dialog.showSaveDialog;
    }, report);
    await nav('Settings');
    await page.getByRole('button', { name: 'Export diagnostics', exact: true }).first().click();
    const text = await eventually(async () => readFileSync(report, 'utf8'), v => v.length > 0);
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain('placeholder-a');
    expect(text).not.toContain('placeholder-b');
  });

  it('stops the backend it started when the app quits', async () => {
    await app.close();
    await eventually(async () => fetch(`http://127.0.0.1:${port}/teamclaude/status`).then(() => false, () => true), gone => gone);
  });
});
