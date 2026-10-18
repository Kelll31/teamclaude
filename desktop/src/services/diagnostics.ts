// A diagnostic report a user can attach to an issue. Built only from data the
// app already holds in sanitized form (normalized status, sanitized log lines)
// and passed through the redactor once more as a whole. It never includes the
// config file, request bodies or account credentials.

import type { BackendState, LogLine, SystemInfo } from '../shared/types';
import { sanitizeText } from './sanitize';

function pct(value: number | null): string {
  return value === null ? 'unknown' : `${Math.round(value * 100)}%`;
}

export function buildDiagnosticReport(system: SystemInfo, state: BackendState, logs: LogLine[], now: Date = new Date()): string {
  const lines: string[] = [];
  lines.push('# TeamClaude Desktop diagnostic report', '');
  lines.push(`Generated: ${now.toISOString()}`, '');
  lines.push('## System');
  lines.push(`- OS: ${system.os} (${system.arch})`);
  lines.push(`- Desktop: ${system.desktopVersion} (Electron ${system.electronVersion}, Node ${system.nodeVersion})`);
  lines.push(`- Bundled backend: ${system.bundledBackendVersion ?? 'not found'}`);
  lines.push(`- Running backend: ${system.backendVersion ?? 'not running'}`, '');
  lines.push('## Proxy');
  lines.push(`- Phase: ${state.phase}`);
  lines.push(`- Ownership: ${state.ownership}`);
  lines.push(`- Endpoint: ${state.endpoint}`);
  lines.push(`- Config file present: ${state.configExists ? 'yes' : 'no'}`);
  lines.push(`- systemd --user unit installed: ${state.serviceInstalled ? 'yes' : 'no'}`);
  lines.push(`- Automatic restarts: ${state.restartCount}`);
  if (state.compatibility.message) lines.push(`- Compatibility: ${state.compatibility.message}`);
  if (state.lastError) lines.push(`- Last error: ${state.lastError.split('\n')[0]}`);
  lines.push('');
  const status = state.status;
  if (status) {
    lines.push('## Accounts');
    // Account names can be email addresses; the report numbers them instead.
    status.accounts.forEach((a, i) => {
      lines.push(`- #${i + 1} ${a.provider}/${a.type}: status=${a.status}, unavailable=${a.unavailable ?? 'no'}, disabled=${a.disabled}, 5h=${pct(a.fiveHour.utilization)}, weekly=${pct(a.weekly.utilization)}${a.error ? `, error=${a.error.code}` : ''}`);
    });
    lines.push('');
    lines.push(`Sessions: ${status.sessions.active} active / ${status.sessions.known} known; distribution: ${status.sessions.distribution ?? 'unknown'}`);
    lines.push(`Switch threshold: ${pct(status.switchThreshold)}; probe: ${status.probe.enabled ? `${status.probe.intervalSeconds}s` : 'off'}; warm-up: ${status.warm.enabled ? `${status.warm.intervalSeconds}s` : 'off'}`);
    lines.push('');
  }
  lines.push('## Recent log (last 200 lines)', '```');
  for (const line of logs.slice(-200)) lines.push(`${new Date(line.at).toISOString()} [${line.stream}] ${line.text}`);
  lines.push('```', '');
  return sanitizeText(lines.join('\n'));
}
