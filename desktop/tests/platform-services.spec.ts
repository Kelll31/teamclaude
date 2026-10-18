import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { autostartDir, desktopEntry, launchCommand, quoteExecArg, setLinuxAutostart } from '../src/services/autostart';
import { backendSpawnSpec, readBackendVersion, resolveBackendLocation } from '../src/services/backend-runtime';
import { envSnippets, findExecutable, terminalCommand, vscodeSnippet } from '../src/services/integrations';
import { checkForUpdates } from '../src/services/update-check';

describe('autostart', () => {
  it('quotes Exec arguments per the Desktop Entry spec', () => {
    expect(quoteExecArg('/opt/app/tc')).toBe('/opt/app/tc');
    expect(quoteExecArg('/home/u/My Apps/tc')).toBe('"/home/u/My Apps/tc"');
    expect(quoteExecArg('/a/$x"y')).toBe('"/a/\\$x\\"y"');
    expect(quoteExecArg('/a/100%')).toBe('/a/100%%');
  });

  it('points at the AppImage, not its temporary mount', () => {
    expect(launchCommand('/tmp/.mount_x/tc', { APPIMAGE: '/home/u/tc.AppImage' })).toBe('/home/u/tc.AppImage');
    expect(launchCommand('/usr/bin/tc', {})).toBe('/usr/bin/tc');
    expect(desktopEntry('/usr/bin/tc')).toContain('Exec=/usr/bin/tc --autostart');
  });

  it('writes and removes only the user autostart entry', () => {
    const ops: string[] = [];
    const fs = { write: (p: string) => ops.push(`w ${p}`), remove: (p: string) => ops.push(`r ${p}`) };
    const file = setLinuxAutostart(true, '/usr/bin/tc', { env: {}, home: '/home/u', fs });
    setLinuxAutostart(false, '/usr/bin/tc', { env: {}, home: '/home/u', fs });
    expect(file).toBe(join(autostartDir({}, '/home/u'), 'teamclaude-desktop.desktop'));
    expect(ops).toEqual([`w ${file}`, `r ${file}`]);
  });
});

describe('backend runtime', () => {
  it('finds the bundled backend outside the ASAR, or the checkout in development', () => {
    const exists = () => true;
    expect(resolveBackendLocation({ packaged: true, resourcesPath: '/res', appPath: '/app', exists })?.root).toBe(join('/res', 'backend'));
    expect(resolveBackendLocation({ packaged: false, resourcesPath: '/res', appPath: '/repo/desktop', exists })).toMatchObject({
      root: resolve('/repo'), source: 'checkout',
    });
    expect(resolveBackendLocation({ packaged: true, resourcesPath: '/res', appPath: '/app', exists: () => false })).toBeNull();
  });

  it('runs through Electron as Node with self-update off, without a shell', () => {
    const spec = backendSpawnSpec('/e/electron', { entry: '/b/src/index.js', root: '/b', source: 'bundled' }, ['server', '--headless'], { PATH: '/bin' });
    expect(spec.command).toBe('/e/electron');
    expect(spec.args).toEqual(['--disable-warning=DEP0190', '/b/src/index.js', 'server', '--headless']);
    expect(spec.env).toMatchObject({ ELECTRON_RUN_AS_NODE: '1', TEAMCLAUDE_DISABLE_AUTOUPDATE: '1', TEAMROUTER_DISABLE_AUTOUPDATE: '1', PATH: '/bin' });
  });

  it('reads the backend version from package.json', () => {
    expect(readBackendVersion('/b', () => '{"version":"1.1.25"}')).toBe('1.1.25');
    expect(readBackendVersion('/b', () => { throw new Error('ENOENT'); })).toBeNull();
  });
});

describe('integrations', () => {
  it('finds executables with PATHEXT on Windows and plain names elsewhere', () => {
    const seen = new Set([join('C:\\bin', 'claude.cmd'), join('/usr/bin', 'codex')]);
    expect(findExecutable('claude', { PATH: 'C:\\none;C:\\bin', PATHEXT: '.EXE;.CMD' }, 'win32', p => seen.has(p))).toBe(join('C:\\bin', 'claude.cmd'));
    expect(findExecutable('codex', { PATH: ['/usr/local/bin', '/usr/bin'].join(process.platform === 'win32' ? ';' : ':') }, 'linux', p => seen.has(p))).toBe(join('/usr/bin', 'codex'));
    expect(findExecutable('missing', { PATH: '/usr/bin' }, 'linux', () => false)).toBeNull();
  });

  it('builds environment snippets with no secrets', () => {
    const env = envSnippets(3456);
    expect(env.posix).toBe('export ANTHROPIC_BASE_URL=http://localhost:3456');
    expect(env.powershell).toBe('$env:ANTHROPIC_BASE_URL = "http://localhost:3456"');
    expect(JSON.parse(vscodeSnippet(3456))).toEqual({
      'claudeCode.environmentVariables': [{ name: 'ANTHROPIC_BASE_URL', value: 'http://localhost:3456' }],
    });
  });

  it('picks a terminal without ever building a shell string from $TERMINAL', () => {
    expect(terminalCommand('win32', {}, n => (n === 'wt' ? 'C:\\wt.exe' : null))?.command).toBe('C:\\wt.exe');
    expect(terminalCommand('win32', { ComSpec: 'C:\\cmd.exe' }, () => null)?.command).toBe('C:\\cmd.exe');
    expect(terminalCommand('linux', { TERMINAL: 'rm -rf /' }, n => (n === 'xterm' ? '/usr/bin/xterm' : null))?.command).toBe('/usr/bin/xterm');
    expect(terminalCommand('linux', {}, () => null)).toBeNull();
  });
});

describe('update check', () => {
  it('compares against the registry without downloading anything', async () => {
    expect(await checkForUpdates('1.1.0', async () => ({ version: '1.2.0' }))).toMatchObject({ latest: '1.2.0', updateAvailable: true, error: null });
    expect(await checkForUpdates('1.2.0', async () => ({ version: '1.2.0' }))).toMatchObject({ updateAvailable: false });
    expect(await checkForUpdates('1.2.0', async () => { throw new Error('offline'); })).toMatchObject({ latest: null, error: 'offline' });
    expect((await checkForUpdates('1.2.0', async () => ({}))).error).toBeTruthy();
  });
});
