// Display helpers. A missing value is shown as "Unknown" — never estimated.

import { t, type MessageKey } from './i18n';

export function unknown(): string {
  return t('common.unknown');
}

export function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? unknown() : `${Math.round(value * 100)}%`;
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${t('time.d', { n: d })} ${t('time.h', { n: h })}`;
  if (h > 0) return `${t('time.h', { n: h })} ${t('time.m', { n: m })}`;
  if (m > 0) return t('time.m', { n: m });
  return t('time.s', { n: s });
}

export function until(at: number | null | undefined, now: number): string {
  if (at === null || at === undefined) return unknown();
  if (at <= now) return t('time.now');
  return t('time.in', { t: duration(at - now) });
}

export function ago(at: number | null | undefined, now: number): string {
  if (at === null || at === undefined) return unknown();
  const ms = now - at;
  if (ms < 5000) return t('time.justNow');
  return t('time.ago', { t: duration(ms) });
}

export function isoUntil(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : until(at, now);
}

/** The server's `unavailable` reason codes (account-manager.js unavailableReason). */
export const REASON_CODES = [
  'disabled', 'spend-capped', 'capped', 'entitlement', 'routing', 'credential', 'throttled', 'exhausted',
  'error', 'quota', 'upstream-rejected', 'route', 'advisor-capped', 'advisor-quota', 'advisor-route',
] as const;

export function unavailableText(code: string | null): string {
  if (code === null) return t('reason.available');
  return (REASON_CODES as readonly string[]).includes(code) ? t(`reason.${code}` as MessageKey) : code;
}

export function phaseText(phase: string): string {
  return t(`phase.${phase}` as MessageKey);
}

export function truncateMiddle(text: string, max = 24): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(-half)}`;
}
