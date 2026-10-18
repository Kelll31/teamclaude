// One quota window: utilization bar, reset countdown, age of the reading.
// With no reading it says "Unknown" and draws an empty bar — it never
// guesses a number.

import type { AccountView, QuotaWindow } from '../../shared/types';
import { ago, pct, until } from '../format';
import { t } from '../i18n';
import { cx } from './ui';

export function QuotaBar({ label, window, now, threshold, emptyHint }: {
  label: string;
  window: QuotaWindow;
  now: number;
  threshold: number | null;
  /** What to say instead of the reset/age line when there is no reading. */
  emptyHint?: string;
}) {
  const u = window.utilization;
  const known = u !== null;
  const width = known ? Math.max(0, Math.min(1, u)) * 100 : 0;
  const tone = !known ? 'bg-muted/30' : u >= 1 ? 'bg-bad' : threshold !== null && u >= threshold ? 'bg-warn' : 'bg-ok';
  // Two "Unknown"s under an "Unknown" say nothing the bar does not.
  const hint = known ? null : emptyHint ?? (window.resetAt === null && window.seenAt === null ? t('quota.noReading') : null);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate font-medium text-muted">{label}</span>
        <span className={cx('tabular-nums', known ? 'text-fg' : 'text-muted')}>{pct(u)}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-panel-2"
        role="meter"
        aria-label={t('quota.used', { label })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? Math.round(width) : undefined}
        aria-valuetext={known ? `${Math.round(width)}%` : t('common.unknown')}
      >
        <div className={cx('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${width}%` }} />
      </div>
      {hint !== null ? (
        <div className="mt-1 truncate text-[11px] text-muted" title={hint}>{hint}</div>
      ) : (
        <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
          <span className="truncate">{t('quota.resets', { when: until(window.resetAt, now) })}</span>
          <span className="truncate" title={t('quota.seenTitle')}>{t('quota.seen', { when: ago(window.seenAt, now) })}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The 5-hour bar, by the server's own rule (showSessionRow in
 * status-renderer.js): a plan that meters no session window gets no row, and
 * a reading still present is drawn whatever the flag says. The server clears
 * the reading when the window ends, so an empty bar on a plan that does meter
 * one means "ended, the next request opens a new one" — not 0%, since the
 * account may be in use outside the proxy.
 */
export function FiveHourBar({ account, now, threshold }: { account: AccountView; now: number; threshold: number | null }) {
  const empty = account.fiveHour.utilization === null;
  if (empty && account.sessionWindowStated === false) return null;
  return (
    <QuotaBar
      label={t('quota.fiveHour')}
      window={account.fiveHour}
      now={now}
      threshold={threshold}
      emptyHint={empty && account.sessionWindowStated === true ? t('quota.windowEnded') : undefined}
    />
  );
}
