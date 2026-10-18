// Manual update check (MVP): asks the npm registry for the latest published
// @karpeleslab/teamclaude and compares it with the bundled backend. Nothing is
// downloaded or installed — automatic updates wait for an agreed signing and
// release scheme (see docs/desktop-architecture.md).

import https from 'node:https';
import type { UpdateCheckResult } from '../shared/types';
import { compareVersions } from './version';

export const REGISTRY_URL = 'https://registry.npmjs.org/@karpeleslab%2fteamclaude/latest';
export const RELEASES_URL = 'https://github.com/KarpelesLab/teamclaude/releases';

export type JsonGetter = (url: string, timeoutMs: number) => Promise<unknown>;

export const httpsJson: JsonGetter = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { accept: 'application/json' }, timeout: timeoutMs }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`registry answered HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > 1_000_000) req.destroy(new Error('registry response too large'));
        else chunks.push(c);
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new Error('registry response was not JSON'));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('registry request timed out')));
    req.on('error', reject);
  });

export async function checkForUpdates(current: string, get: JsonGetter = httpsJson): Promise<UpdateCheckResult> {
  try {
    const body = await get(REGISTRY_URL, 10_000);
    const latest = body && typeof body === 'object' ? (body as { version?: unknown }).version : null;
    if (typeof latest !== 'string') throw new Error('registry response had no version');
    return { current, latest, updateAvailable: compareVersions(current, latest) === -1, url: RELEASES_URL, error: null };
  } catch (err) {
    return { current, latest: null, updateAvailable: false, url: RELEASES_URL, error: (err as Error).message };
  }
}
