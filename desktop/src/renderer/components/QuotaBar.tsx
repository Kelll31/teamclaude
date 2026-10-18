// One quota window: utilization bar, reset countdown, age of the reading.
// With no reading it says "Unknown" and draws an empty bar — it never
// guesses a number.

import type { QuotaWindow } from '../../shared/types';
import { ago, pct, until } from '../format';
import { t } from '../i18n';
import { cx } from './ui';

export function QuotaBar({ label, window, now, threshold }: { label: string; window: QuotaWindow; now: number; threshold: number | null }) {
  const u = window.utilization;
  const known = u !== null;
  const width = known ? Math.max(0, Math.min(1, u)) * 100 : 0;
  const tone = !known ? 'bg-muted/30' : u >= 1 ? 'bg-bad' : threshold !== null && u >= threshold ? 'bg-warn' : 'bg-ok';
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
      <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
        <span className="truncate">{t('quota.resets', { when: until(window.resetAt, now) })}</span>
        <span className="truncate" title={t('quota.seenTitle')}>{t('quota.seen', { when: ago(window.seenAt, now) })}</span>
      </div>
    </div>
  );
}
